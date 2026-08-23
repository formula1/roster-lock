import { beforeEach, afterEach, vi } from "vitest";
import { InMemoryMessageQueue } from "../src/message-queue/memory";
import { runMessageQueueSuite } from "../src/message-queue/suite";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

runMessageQueueSuite("InMemoryMessageQueue", {
  createQueue: () => new InMemoryMessageQueue(),
  advance: async (ms) => {
    await vi.advanceTimersByTimeAsync(ms);
  },
});
