import { describe, it, expect, vi } from "vitest";
import { StartGameArgs } from "@roster-lock/types";
import Headless, { HeadlessGameConfig } from "../src/index";

const CONNECTION = { type: "internal" } as const;
const TARGET = { platform: "linux", arch: "x64" } as const;

function argsFor(gameConfig: Partial<HeadlessGameConfig>, gameEnded = vi.fn()): StartGameArgs<HeadlessGameConfig> {
  return {
    relayRoomId: "room-1",
    currentMachine: { machineId: "m1", publicKey: "pk", privateKeyFile: "/tmp/key" },
    allMachines: [],
    rosterConfig: {},
    matchAgent: { port: 9000, authCode: "auth" },
    gameConfig: gameConfig as HeadlessGameConfig,
    selectionResult: { finalSelection: {}, downloadResults: {} },
    gameEnded,
  } as unknown as StartGameArgs<HeadlessGameConfig>;
}

describe("headless game-launcher plugin", () => {
  it("reports the configured winners once the delay elapses", async () => {
    vi.useFakeTimers();
    try {
      const gameEnded = vi.fn();
      const args = argsFor({ winners: ["pk-a:0"], resultDelayMs: 50 }, gameEnded);
      const handle = await Headless.startGame("/dev/null", TARGET, CONNECTION, args);

      expect(handle.exited).toBe(false);
      expect(gameEnded).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);

      expect(handle.exited).toEqual({ code: 0 });
      expect(gameEnded).toHaveBeenCalledExactlyOnceWith({ winners: ["pk-a:0"] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never calls gameEnded when no winners are configured", async () => {
    vi.useFakeTimers();
    try {
      const gameEnded = vi.fn();
      const args = argsFor({ winners: [], resultDelayMs: 0 }, gameEnded);
      const handle = await Headless.startGame("/dev/null", TARGET, CONNECTION, args);

      await vi.advanceTimersByTimeAsync(0);

      expect(handle.exited).toEqual({ code: 0 });
      expect(gameEnded).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires onExit callbacks once settled", async () => {
    vi.useFakeTimers();
    try {
      const args = argsFor({ winners: [], resultDelayMs: 10 });
      const handle = await Headless.startGame("/dev/null", TARGET, CONNECTION, args);
      const onExit = vi.fn();
      handle.onExit(onExit);

      await vi.advanceTimersByTimeAsync(10);

      expect(onExit).toHaveBeenCalledExactlyOnceWith(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() settles the handle early without reporting a result", async () => {
    vi.useFakeTimers();
    try {
      const gameEnded = vi.fn();
      const args = argsFor({ winners: ["pk-a:0"], resultDelayMs: 10_000 }, gameEnded);
      const handle = await Headless.startGame("/dev/null", TARGET, CONNECTION, args);

      await handle.stop();
      expect(handle.exited).toEqual({ code: -1 });

      // Stopping clears the timer - advancing past the original delay must
      // not still fire a late result.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(gameEnded).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("declares a fixed version and always validates the binary location", async () => {
    await expect(Headless.getLocalVersion("/dev/null", TARGET)).resolves.toEqual({ title: "headless", id: "headless" });
    await expect(Headless.getSupportedVersion("/dev/null")).resolves.toEqual({ title: "headless", id: "headless" });
    await expect(Headless.validateBinaryLocation("/dev/null", TARGET)).resolves.toEqual({ valid: true });
  });
});
