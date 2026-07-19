import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";

async function runRescan(args: Array<string>){
  vi.resetModules();
  const { rescanCommand } = await import("../../src/commands/roster/rescan.js");

  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  await rescanCommand.parseAsync(["node", "rescan", ...args]);
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  const exitCode = process.exitCode;
  process.exitCode = undefined;
  return { logs, exitCode };
}

describe("roster rescan", () => {
  let tempDir: string;
  let draftPath: string;
  let pieceFolder: string;
  let existingPiece: RosterLockV1Draft["stagedLock"]["rosters"][string][0];

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-rescan-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");
    pieceFolder = pathJoin(tempDir, "blue-character");
    mkdirSync(pieceFolder);
    writeFileSync(pathJoin(pieceFolder, "sprite.png"), "fake-png-bytes-v1");

    const draft: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = {
      selectionStrategy: "mandatory",
      requires: ["move"],
      pathVariables: [],
      assets: [{ name: "sprite", classification: "media", count: 1, glob: ["*.png"] }],
    };
    draft.stagedLock.engine.pieceDefinitions["move"] = {
      selectionStrategy: "on demand",
      requires: [],
      pathVariables: [],
      assets: [],
    };
    draft.stagedLock.rosters["move"] = [{
      id: "move-basic",
      version: { logic: "d".repeat(64), media: "e".repeat(64), docs: "f".repeat(64) },
      humanInfo: { name: "Basic", author: "author", url: "https://example.com/basic" },
      downloadSources: ["https://example.com/basic.tar"],
      pathVariables: {},
      requiredPieces: {},
    }];
    existingPiece = {
      id: "character-blue",
      version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
      humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
      downloadSources: ["https://example.com/blue.tar"],
      pathVariables: {},
      requiredPieces: { move: { selectable: true, expected: ["move-basic"] } },
    };
    draft.stagedLock.rosters["character"] = [existingPiece];
    draft.draft.rosterPieceInfo["character"] = {
      "character-blue": {
        referenceFolder: pieceFolder,
        testedDownloadSources: [
          { source: "https://example.com/blue.tar", testedAt: new Date().toISOString(), version: existingPiece.version },
        ],
      },
    };
    writeFileSync(draftPath, JSON.stringify(draft));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function readDraft(){
    return JSON.parse(readFileSync(draftPath, "utf-8")) as RosterLockV1Draft;
  }
  function readPiece(){
    return readDraft().stagedLock.rosters["character"][0];
  }

  it("recomputes the version hash using the recorded reference folder, keeping id/humanInfo/requiredPieces", async () => {
    writeFileSync(pathJoin(pieceFolder, "sprite.png"), "fake-png-bytes-v2");

    const { exitCode } = await runRescan(["character", "character-blue", "--draft", draftPath]);
    expect(exitCode).toBeUndefined();

    const piece = readPiece();
    expect(piece.id).toBe("character-blue");
    expect(piece.humanInfo).toEqual(existingPiece.humanInfo);
    expect(piece.downloadSources).toEqual(existingPiece.downloadSources);
    expect(piece.requiredPieces).toEqual({ move: { selectable: true, expected: ["move-basic"] } });
    expect(piece.version.media).not.toBe("b".repeat(64));
  });

  it("resets testedDownloadSources for the piece since the hash changed", async () => {
    writeFileSync(pathJoin(pieceFolder, "sprite.png"), "fake-png-bytes-v2");

    await runRescan(["character", "character-blue", "--draft", draftPath]);

    const draft = readDraft();
    expect(draft.draft.rosterPieceInfo["character"]["character-blue"].testedDownloadSources).toEqual([]);
  });

  it("accepts an explicit folder argument overriding the recorded reference folder", async () => {
    const otherFolder = pathJoin(tempDir, "other-folder");
    mkdirSync(otherFolder);
    writeFileSync(pathJoin(otherFolder, "sprite.png"), "different-bytes");

    const { exitCode } = await runRescan(["character", "character-blue", otherFolder, "--draft", draftPath]);
    expect(exitCode).toBeUndefined();

    const draft = readDraft();
    expect(draft.draft.rosterPieceInfo["character"]["character-blue"].referenceFolder).toBe(otherFolder);
  });

  it("fails when the folder no longer matches the piece type's asset definitions", async () => {
    rmSync(pathJoin(pieceFolder, "sprite.png"));

    const { exitCode } = await runRescan(["character", "character-blue", "--draft", draftPath]);
    expect(exitCode).toBe(1);

    const piece = readPiece();
    expect(piece.version.media).toBe("b".repeat(64));
  });

  it("fails for an unknown piece id", async () => {
    const { exitCode } = await runRescan(["character", "character-missing", "--draft", draftPath]);
    expect(exitCode).toBe(1);
  });
});
