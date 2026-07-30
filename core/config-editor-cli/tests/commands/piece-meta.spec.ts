import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";
import { pieceMetaSetCommand } from "../../src/commands/piece-meta/set";
import { pieceMetaShowCommand } from "../../src/commands/piece-meta/show";

async function runPieceMetaSet(args: Array<string>){
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await pieceMetaSetCommand.parseAsync(["node", "set", ...args]);
  } catch(e){
    thrown = e;
  }
  return { thrown };
}

async function runPieceMetaShow(args: Array<string>){
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = undefined;
  await pieceMetaShowCommand.parseAsync(["node", "show", ...args]);
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  return { logs };
}

describe("piece-meta set/show", () => {
  let tempDir: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-piece-meta-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");

    const draft: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = {
      selectionStrategy: "mandatory",
      requires: [],
      pathVariables: [],
      assets: [],
    };
    draft.stagedLock.rosters["character"] = [{
      id: "@author/blue",
      version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
      humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
      downloadSources: ["https://example.com/blue.tar"],
      pathVariables: {},
      requiredPieces: {},
    }];
    draft.stagedLock.selection.piece["character"] = { type: "unselectable" };
    writeFileSync(draftPath, JSON.stringify(draft));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function readDraftFile(): RosterLockV1Draft {
    return JSON.parse(readFileSync(draftPath, "utf-8"));
  }

  it("sets the schema/defaultMeta/values for a piece type, independent of the selection config", async () => {
    const jsonPath = pathJoin(tempDir, "meta.json");
    writeFileSync(jsonPath, JSON.stringify({
      schema: { power: "number" },
      defaultMeta: { power: 1 },
      values: { "@author/blue": { power: 5 } },
    }));

    await runPieceMetaSet(["character", "--draft", draftPath, "--json", jsonPath]);

    const meta = readDraftFile().stagedLock.pieceMeta["character"];
    expect(meta.schema).toEqual({ power: "number" });
    expect(meta.defaultMeta).toEqual({ power: 1 });
    expect(meta.values).toEqual({ "@author/blue": { power: 5 } });
    // Unrelated to the selection config for that piece type
    expect(readDraftFile().stagedLock.selection.piece["character"]).toEqual({ type: "unselectable" });
  });

  it("defaults to an empty schema/defaultMeta/values when no --json is given", async () => {
    await runPieceMetaSet(["character", "--draft", draftPath]);

    const meta = readDraftFile().stagedLock.pieceMeta["character"];
    expect(meta).toEqual({ schema: {}, defaultMeta: {}, values: {} });
  });

  it("rejects per-piece values referencing a piece not in the roster", async () => {
    const jsonPath = pathJoin(tempDir, "meta.json");
    writeFileSync(jsonPath, JSON.stringify({
      schema: { power: "number" },
      defaultMeta: { power: 1 },
      values: { "@author/missing": { power: 2 } },
    }));

    const { thrown } = await runPieceMetaSet(["character", "--draft", draftPath, "--json", jsonPath]);
    expect(thrown).toBeUndefined(); // withErrorHandling swallows and sets exitCode instead
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("rejects --json with an unrecognized field", async () => {
    const jsonPath = pathJoin(tempDir, "bad-meta.json");
    writeFileSync(jsonPath, JSON.stringify({ notARealField: true }));

    await runPieceMetaSet(["character", "--draft", draftPath, "--json", jsonPath]);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("show prints the staged lock's piece meta", async () => {
    const jsonPath = pathJoin(tempDir, "meta.json");
    writeFileSync(jsonPath, JSON.stringify({ schema: { power: "number" }, defaultMeta: { power: 1 } }));
    await runPieceMetaSet(["character", "--draft", draftPath, "--json", jsonPath]);

    const { logs } = await runPieceMetaShow(["--draft", draftPath]);
    const printed = JSON.parse(logs.join(""));
    expect(printed["character"].schema).toEqual({ power: "number" });
  });
});
