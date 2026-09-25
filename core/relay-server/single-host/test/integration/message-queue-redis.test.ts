import { beforeEach, afterEach, afterAll } from "vitest";
import { Redis } from "ioredis";
import { RedisMessageQueue } from "../../src/message-queue/versions/redis";
import { runMessageQueueSuite } from "../../src/message-queue/suite";
import { REDIS_URL } from "./globalSetup";

// The suite's tests reuse the same key/channel names (e.g. "room-a") and
// run against one real, persistent redis instance rather than a fresh Map
// per test - flush between tests so they stay independent regardless of
// what an earlier test in the file left claimed/subscribed.
const admin = new Redis(REDIS_URL);
beforeEach(async () => {
  await admin.flushdb();
});
afterAll(async () => {
  await admin.quit();
});

const openQueues: Array<RedisMessageQueue> = [];
afterEach(async () => {
  await Promise.all(openQueues.splice(0).map((queue) => queue.close()));
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runMessageQueueSuite("RedisMessageQueue", {
  createQueue: () => {
    const queue = new RedisMessageQueue(REDIS_URL);
    openQueues.push(queue);
    return queue;
  },
  advance: sleep,
});
