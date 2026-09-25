import { describe, it, expect } from "vitest";
import { IMessageQueue } from "./types";

export type MessageQueueSuiteOptions = {
  createQueue: () => IMessageQueue | Promise<IMessageQueue>;
  // Waits at least `ms`, letting a claim's TTL actually lapse - real time
  // for a redis-backed queue, fast-forwarded fake timers for the in-memory
  // one (so the suite doesn't spend real wall-clock time on every claim).
  advance: (ms: number) => Promise<void>;
};

// Run against both IMessageQueue implementations so they're held to the
// exact same contract - divergence here would silently break whichever
// caller ends up relying on claim/pub-sub semantics to route relay traffic.
export function runMessageQueueSuite(name: string, options: MessageQueueSuiteOptions) {
  describe(name, () => {
    it("claims an unclaimed key and reports its owner", async () => {
      const queue = await options.createQueue();
      await expect(queue.claim("room-a", "server-1", 10_000)).resolves.toBe(true);
      await expect(queue.getOwner("room-a")).resolves.toBe("server-1");
    });

    it("reports no owner for an unclaimed key", async () => {
      const queue = await options.createQueue();
      await expect(queue.getOwner("unclaimed")).resolves.toBeNull();
    });

    it("refuses a claim already held by a different owner", async () => {
      const queue = await options.createQueue();
      await queue.claim("room-a", "server-1", 10_000);
      await expect(queue.claim("room-a", "server-2", 10_000)).resolves.toBe(false);
      await expect(queue.getOwner("room-a")).resolves.toBe("server-1");
    });

    it("lets the current owner renew its own claim", async () => {
      const queue = await options.createQueue();
      await queue.claim("room-a", "server-1", 10_000);
      await expect(queue.claim("room-a", "server-1", 10_000)).resolves.toBe(true);
      await expect(queue.getOwner("room-a")).resolves.toBe("server-1");
    });

    it("frees a claim once its TTL lapses without renewal", async () => {
      const queue = await options.createQueue();
      await queue.claim("room-a", "server-1", 100);
      await options.advance(200);
      await expect(queue.getOwner("room-a")).resolves.toBeNull();
      await expect(queue.claim("room-a", "server-2", 10_000)).resolves.toBe(true);
    });

    it("releases a claim only when the caller still owns it", async () => {
      const queue = await options.createQueue();
      await queue.claim("room-a", "server-1", 10_000);

      await queue.release("room-a", "server-2");
      await expect(queue.getOwner("room-a")).resolves.toBe("server-1");

      await queue.release("room-a", "server-1");
      await expect(queue.getOwner("room-a")).resolves.toBeNull();
    });

    it("delivers a published message to a subscriber", async () => {
      const queue = await options.createQueue();
      const received: Array<unknown> = [];
      await queue.subscribe("channel-a", (message) => received.push(message));

      await queue.publish("channel-a", { hello: "world" });
      await options.advance(0);

      expect(received).toEqual([{ hello: "world" }]);
    });

    it("fans a published message out to every subscriber", async () => {
      const queue = await options.createQueue();
      const receivedA: Array<unknown> = [];
      const receivedB: Array<unknown> = [];
      await queue.subscribe("channel-a", (message) => receivedA.push(message));
      await queue.subscribe("channel-a", (message) => receivedB.push(message));

      await queue.publish("channel-a", "ping");
      await options.advance(0);

      expect(receivedA).toEqual(["ping"]);
      expect(receivedB).toEqual(["ping"]);
    });

    it("does not deliver to a channel with no subscribers", async () => {
      const queue = await options.createQueue();
      await expect(queue.publish("nobody-listening", "ping")).resolves.toBeUndefined();
    });

    it("stops delivering to an unsubscribed handler", async () => {
      const queue = await options.createQueue();
      const received: Array<unknown> = [];
      const unsubscribe = await queue.subscribe("channel-a", (message) => received.push(message));

      unsubscribe();
      await queue.publish("channel-a", "ping");
      await options.advance(0);

      expect(received).toEqual([]);
    });

    it("does not deliver messages published before a handler subscribed", async () => {
      const queue = await options.createQueue();
      await queue.publish("channel-a", "before");
      await options.advance(0);

      const received: Array<unknown> = [];
      await queue.subscribe("channel-a", (message) => received.push(message));
      await options.advance(0);

      expect(received).toEqual([]);
    });
  });
}
