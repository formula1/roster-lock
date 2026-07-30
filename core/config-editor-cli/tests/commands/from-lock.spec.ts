import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_LOCK } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { fromLockCommand } from "../../src/commands/draft/from-lock";

async function runFromLock(args: Array<string>){
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = undefined;

  await fromLockCommand.parseAsync(["node", "from-lock", ...args]);

  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  return logs;
}

function buildLockWithRoster(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.title = "My Game";
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: [],
    assets: [{ name: "sprite", classification: "media", count: 1, glob: ["*.png"] }],
  };
  lock.rosters["character"] = [{
    id: "@author/blue",
    version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
    humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
    downloadSources: ["https://example.com/blue.tar"],
    pathVariables: {},
    requiredPieces: {},
  }];
  lock.selection.piece["character"] = {
    type: "unselectable",
  };
  return lock;
}

describe("draft from-lock", () => {
  let tempDir: string;
  let lockPath: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-from-lock-"));
    lockPath = pathJoin(tempDir, "my-game-1.0.0.rosterlock.json");
    draftPath = pathJoin(tempDir, "out.rosterlock.draft.json");
    writeFileSync(lockPath, JSON.stringify(buildLockWithRoster()));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("copies the lock's rosters and selection into the draft by default", async () => {
    await runFromLock([lockPath, draftPath]);

    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    expect(draft.stagedLock.rosters["character"]).toHaveLength(1);
    expect(draft.stagedLock.selection.piece["character"]).toBeDefined();
    expect(draft.previousLock.rosters["character"]).toHaveLength(1);
  });

  it("--clear-rosters keeps the engine but empties rosters and per-type selection", async () => {
    const logs = await runFromLock([lockPath, draftPath, "--clear-rosters"]);

    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    expect(draft.stagedLock.engine.pieceDefinitions["character"]).toBeDefined();
    expect(draft.stagedLock.rosters["character"]).toEqual([]);
    expect(draft.stagedLock.selection.piece).toEqual({});
    // previousLock is left untouched so future diffs reflect the roster removal
    expect(draft.previousLock.rosters["character"]).toHaveLength(1);
    expect(logs.join("\n")).toMatch(/rosters cleared/);
  });
});
