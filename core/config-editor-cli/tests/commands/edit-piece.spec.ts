import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";

// Repeatable options (--add-download-source etc.) accumulate into a default array
// captured once at `.option()`-declare time, so reusing one Command instance across
// parseAsync() calls leaks values between tests. A real CLI process only parses once,
// so this only matters here: re-import the module fresh for every call to get a clean
// Command instance and options.
async function runEditPiece(args: Array<string>){
  vi.resetModules();
  const { editPieceCommand } = await import("../../src/commands/roster/edit-piece.js");

  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  await editPieceCommand.parseAsync(["node", "edit-piece", ...args]);
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  const exitCode = process.exitCode;
  process.exitCode = undefined;
  return { logs, exitCode };
}

describe("roster edit-piece", () => {
  let tempDir: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-edit-piece-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");

    const draft: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = {
      selectionStrategy: "mandatory",
      requires: [],
      pathVariables: ["skin"],
      assets: [{ name: "sprite", classification: "media", count: 1, glob: ["{skin}/*.png"] }],
    };
    draft.stagedLock.rosters["character"] = [{
      id: "@author/blue",
      version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
      humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
      downloadSources: ["https://example.com/blue.tar"],
      pathVariables: { skin: "blue" },
      requiredPieces: {},
    }];
    writeFileSync(draftPath, JSON.stringify(draft));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function readPiece(){
    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    return draft.stagedLock.rosters["character"][0];
  }

  it("updates human info fields", async () => {
    await runEditPiece(["character", "@author/blue", "--draft", draftPath, "--name", "Bluey", "--author", "someone-else"]);

    const piece = readPiece();
    expect(piece.humanInfo.name).toBe("Bluey");
    expect(piece.humanInfo.author).toBe("someone-else");
    expect(piece.humanInfo.url).toBe("https://example.com/blue");
  });

  it("adds and removes download sources", async () => {
    await runEditPiece([
      "character", "@author/blue", "--draft", draftPath,
      "--add-download-source", "https://mirror.example.com/blue.tar",
      "--remove-download-source", "https://example.com/blue.tar",
    ]);

    const piece = readPiece();
    expect(piece.downloadSources).toEqual(["https://mirror.example.com/blue.tar"]);
  });

  it("refuses to remove the last download source", async () => {
    const { exitCode } = await runEditPiece([
      "character", "@author/blue", "--draft", draftPath,
      "--remove-download-source", "https://example.com/blue.tar",
    ]);
    expect(exitCode).toBe(1);
  });

  it("refuses to remove a download source that isn't present", async () => {
    const { exitCode } = await runEditPiece([
      "character", "@author/blue", "--draft", draftPath,
      "--remove-download-source", "https://not-there.example.com/x.tar",
    ]);
    expect(exitCode).toBe(1);
  });

  it("updates path variables, leaving unmentioned keys alone", async () => {
    await runEditPiece(["character", "@author/blue", "--draft", draftPath, "--path-variables", "skin=red"]);
    expect(readPiece().pathVariables).toEqual({ skin: "red" });
  });

  it("rejects removing a path variable the piece definition still requires", async () => {
    const { exitCode } = await runEditPiece([
      "character", "@author/blue", "--draft", draftPath, "--remove-path-variable", "skin",
    ]);
    expect(exitCode).toBe(1);
  });

  it("rejects a no-op call", async () => {
    const { exitCode } = await runEditPiece(["character", "@author/blue", "--draft", draftPath]);
    expect(exitCode).toBe(1);
  });

  it("rejects an unknown piece id", async () => {
    const { exitCode } = await runEditPiece(["character", "@author/ghost", "--draft", draftPath, "--name", "X"]);
    expect(exitCode).toBe(1);
  });

  it("--json bulk-sets humanInfo/downloadSources/pathVariables", async () => {
    const jsonPath = pathJoin(tempDir, "overrides.json");
    writeFileSync(jsonPath, JSON.stringify({
      humanInfo: { name: "Bluey", author: "someone-else", url: "https://example.com/bluey" },
      downloadSources: ["https://mirror.example.com/blue.tar"],
      pathVariables: { skin: "red" },
    }));

    await runEditPiece(["character", "@author/blue", "--draft", draftPath, "--json", jsonPath]);

    const piece = readPiece();
    expect(piece.humanInfo).toEqual({ name: "Bluey", author: "someone-else", url: "https://example.com/bluey" });
    expect(piece.downloadSources).toEqual(["https://example.com/blue.tar", "https://mirror.example.com/blue.tar"]);
    expect(piece.pathVariables).toEqual({ skin: "red" });
  });

  it("a specific flag overrides --json for the same field", async () => {
    const jsonPath = pathJoin(tempDir, "overrides.json");
    writeFileSync(jsonPath, JSON.stringify({ humanInfo: { name: "FromJson", author: "author", url: "https://example.com/blue" } }));

    await runEditPiece(["character", "@author/blue", "--draft", draftPath, "--json", jsonPath, "--name", "FromFlag"]);

    expect(readPiece().humanInfo.name).toBe("FromFlag");
  });

  it("rejects --json with an unrecognized field", async () => {
    const jsonPath = pathJoin(tempDir, "bad-overrides.json");
    writeFileSync(jsonPath, JSON.stringify({ notARealField: true }));

    const { exitCode } = await runEditPiece(["character", "@author/blue", "--draft", draftPath, "--json", jsonPath]);
    expect(exitCode).toBe(1);
  });
});
