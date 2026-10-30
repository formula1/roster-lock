// No caller wires up cross-process relaying yet, so this only exposes the
// two implementations plus a factory - swapping the shared `messageQueue`
// singleton for a real one is a matter of setting MESSAGE_QUEUE_VERSION=redis
// (plus REDIS_URL), same pattern as ../models picking an implementation.
export * from "./types";
export { InMemoryMessageQueue } from "./versions/memory";
export { RedisMessageQueue } from "./versions/redis";

import { IMessageQueue } from "./types";
import { InMemoryMessageQueue } from "./versions/memory";
import { RedisMessageQueue } from "./versions/redis";
import { getMessageQueueVersion, getRedisUrl } from "../globals";

export function createMessageQueue(): IMessageQueue {
  const version = getMessageQueueVersion();
  switch (version) {
    case "redis": {
      const redisUrl = getRedisUrl();
      if (!redisUrl) throw new Error("MESSAGE_QUEUE_VERSION=redis requires REDIS_URL to be set");
      return new RedisMessageQueue(redisUrl);
    }
    case "memory":
      return new InMemoryMessageQueue();
  }
}

export const messageQueue: IMessageQueue = createMessageQueue();
