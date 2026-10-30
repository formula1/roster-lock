import { Redis } from "ioredis";
import { IMessageQueue, Unsubscribe } from "../types";

// Atomically claims-or-renews: `key` is taken if it's unset or already
// owned by ARGV[1], and its TTL is (re)set either way in the same round
// trip - doing this as GET-then-SET from JS would leave a window where
// another owner's claim() could land in between.
const CLAIM_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == false or current == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
  return 1
end
return 0
`;

// Compare-and-delete: only removes `key` if it's still owned by ARGV[1], so
// a release from an owner that already lost the claim can't delete
// whoever holds it now.
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

// Redis implementation of IMessageQueue for a horizontally-scaled relay
// deployment. Uses two connections: `commands` for claim/getOwner/release/
// publish, and `subscriber` dedicated to SUBSCRIBE - once a redis
// connection issues SUBSCRIBE it can't run other commands, so those two
// roles can't share a connection.
export class RedisMessageQueue implements IMessageQueue {
  private commands: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, Set<(message: unknown) => void>>();
  // Per-channel FIFO of pending subscribe/unsubscribe ops. Without this, a
  // subscribe() and a concurrent unsubscribe() on the same channel race:
  // both read `handlers` before either's SUBSCRIBE/UNSUBSCRIBE round trip
  // finishes, so the wire state and the local map can end up disagreeing
  // about whether the channel is actually live.
  private channelQueues = new Map<string, Promise<any>>();

  constructor(redisUrl: string) {
    this.commands = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    // ioredis emits "error" for every connection hiccup (including ones it
    // will transparently retry) - without a listener, node treats it as
    // unhandled and crashes the process, which a transient network blip
    // shouldn't do.
    this.commands.on("error", (error) => console.error("RedisMessageQueue commands connection error", error));
    this.subscriber.on("error", (error) => console.error("RedisMessageQueue subscriber connection error", error));
    this.subscriber.on("message", (channel: string, raw: string) => {
      const handlers = this.handlers.get(channel);
      if (!handlers) return;
      const message = JSON.parse(raw);
      for (const handler of handlers) handler(message);
    });
  }

  async claim(key: string, ownerId: string, ttlMs: number): Promise<boolean> {
    const result = await this.commands.eval(CLAIM_SCRIPT, 1, key, ownerId, ttlMs);
    return result === 1;
  }

  async getOwner(key: string): Promise<string | null> {
    return this.commands.get(key);
  }

  async release(key: string, ownerId: string): Promise<void> {
    await this.commands.eval(RELEASE_SCRIPT, 1, key, ownerId);
  }

  async publish(channel: string, message: unknown): Promise<void> {
    await this.commands.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<Unsubscribe> {
    await this.queueForChannel(channel, async () => {
      let handlers = this.handlers.get(channel);
      if (!handlers) {
        handlers = new Set();
        this.handlers.set(channel, handlers);
        await this.subscriber.subscribe(channel)
      }
      handlers.add(handler);
    });

    return () => {
      void this.queueForChannel(channel, async () => {
        const currentHandlers = this.handlers.get(channel);
        if (!currentHandlers?.delete(handler)) return;
        if (currentHandlers.size > 0) return;
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel)
     });
    };
  }

  async close(): Promise<void> {
    this.handlers.clear();
    await Promise.all([this.commands.quit(), this.subscriber.quit()]);
  }

  private queueForChannel(channel: string, task: () => Promise<void>): Promise<void> {
    const previous = this.channelQueues.get(channel) ?? Promise.resolve();
    const result = previous.then(task, task);
    const settled = result.catch(() => {});
    this.channelQueues.set(channel, settled);
    void settled.then(() => {
      if (this.channelQueues.get(channel) === settled) this.channelQueues.delete(channel);
    });
    return result;
  }
}
