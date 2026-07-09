import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";

// Repeatable options (--download-source) accumulate into a default array captured
// once at `.option()`-declare time, so reusing one Command instance across
// parseAsync() calls leaks values between tests - see edit-piece.spec.ts. Re-import
// fresh for every call.
async function runAddPiece(args: Array<string>){
  vi.resetModules();
  const { addPieceCommand } = await import("../../src/commands/roster/add-piece.js");

  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  await addPieceCommand.parseAsync(["node", "add-piece", ...args]);
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  const exitCode = process.exitCode;
  process.exitCode = undefined;
  return { logs, exitCode };
}

describe("roster add-piece", () => {
  let tempDir: string;
  let draftPath: string;
  let pieceFolder: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-add-piece-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");
    pieceFolder = pathJoin(tempDir, "blue-character");
    mkdirSync(pieceFolder);
    writeFileSync(pathJoin(pieceFolder, "sprite.png"), "fake-png-bytes");

    const draft: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = {
      selectionStrategy: "mandatory",
      requires: [],
      pathVariables: [],
      assets: [{ name: "sprite", classification: "media", count: 1, glob: ["*.png"] }],
    };
    draft.stagedLock.rosters["character"] = [];
    writeFileSync(draftPath, JSON.stringify(draft));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function readPiece(){
    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    return draft.stagedLock.rosters["character"][0];
  }

  it("--json sets humanInfo and additional download sources", async () => {
    const jsonPath = pathJoin(tempDir, "overrides.json");
    writeFileSync(jsonPath, JSON.stringify({
      humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
      downloadSources: ["https://example.com/blue.tar"],
    }));

    await runAddPiece(["character", pieceFolder, "--draft", draftPath, "--json", jsonPath]);

    const piece = readPiece();
    expect(piece.humanInfo).toEqual({ name: "Blue", author: "author", url: "https://example.com/blue" });
    expect(piece.downloadSources).toEqual(["https://example.com/blue.tar"]);
    expect(piece.id).toBe("@author/blue");
  });

  it("still refuses to add a piece with no download source, --json or otherwise", async () => {
    const jsonPath = pathJoin(tempDir, "overrides.json");
    writeFileSync(jsonPath, JSON.stringify({ humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" } }));

    const { exitCode } = await runAddPiece(["character", pieceFolder, "--draft", draftPath, "--json", jsonPath]);
    expect(exitCode).toBe(1);
  });

  it("rejects --json with an unrecognized field", async () => {
    const jsonPath = pathJoin(tempDir, "bad-overrides.json");
    writeFileSync(jsonPath, JSON.stringify({ notARealField: true }));

    const { exitCode } = await runAddPiece([
      "character", pieceFolder, "--draft", draftPath, "--json", jsonPath,
      "--download-source", "https://example.com/blue.tar",
    ]);
    expect(exitCode).toBe(1);
  });
});
