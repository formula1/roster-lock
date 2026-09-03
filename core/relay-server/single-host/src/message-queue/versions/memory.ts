import { IMessageQueue, Unsubscribe } from "../types";

type Claim = {
  ownerId: string;
  timer: ReturnType<typeof setTimeout>;
};

// Single-process stand-in for a real message queue (redis, etc.) - used for
// local dev/tests and for a single-instance deployment that has no need for
// cross-process relaying. Same contract as RedisMessageQueue, just backed by
// local Maps instead of a network round trip.
export class InMemoryMessageQueue implements IMessageQueue {
  private claims = new Map<string, Claim>();
  private channels = new Map<string, Set<(message: unknown) => void>>();

  async claim(key: string, ownerId: string, ttlMs: number): Promise<boolean> {
    const existing = this.claims.get(key);
    if (existing && existing.ownerId !== ownerId) return false;
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => this.claims.delete(key), ttlMs);
    timer.unref?.();
    this.claims.set(key, { ownerId, timer });
    return true;
  }

  async getOwner(key: string): Promise<string | null> {
    return this.claims.get(key)?.ownerId ?? null;
  }

  async release(key: string, ownerId: string): Promise<void> {
    const existing = this.claims.get(key);
    if (!existing || existing.ownerId !== ownerId) return;
    clearTimeout(existing.timer);
    this.claims.delete(key);
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const handlers = this.channels.get(channel);
    if (!handlers) return;
    // Mirrors a real queue's network hop: deliver on a fresh tick rather
    // than synchronously, so publish() never resolves before subscribers
    // added in the same tick have actually run.
    await Promise.resolve();
    for (const handler of handlers) handler(message);
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<Unsubscribe> {
    let handlers = this.channels.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.channels.set(channel, handlers);
    }
    handlers.add(handler);

    return () => {
      if (!handlers!.delete(handler)) return;
      if (handlers!.size === 0) this.channels.delete(channel);
    };
  }

  async close(): Promise<void> {
    for (const claim of this.claims.values()) clearTimeout(claim.timer);
    this.claims.clear();
    this.channels.clear();
  }
}
