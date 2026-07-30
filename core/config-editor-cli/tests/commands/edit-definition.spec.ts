import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";
import { editDefinitionCommand } from "../../src/commands/engine/edit-definition";

async function runEditDefinition(args: Array<string>){
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await editDefinitionCommand.parseAsync(["node", "edit-definition", ...args]);
  } catch(e){
    thrown = e;
  }
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  return { logs, thrown };
}

describe("engine edit-definition", () => {
  let tempDir: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-edit-definition-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");

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

  function readDraftFile(): RosterLockV1Draft {
    return JSON.parse(readFileSync(draftPath, "utf-8"));
  }

  it("updates the selection strategy while leaving assets untouched", async () => {
    await runEditDefinition(["character", "--draft", draftPath, "--strategy", "shared"]);

    const definition = readDraftFile().stagedLock.engine.pieceDefinitions["character"];
    expect(definition.selectionStrategy).toBe("shared");
    expect(definition.assets).toHaveLength(1);
  });

  it("replaces the path-variables list", async () => {
    await runEditDefinition(["character", "--draft", draftPath, "--path-variables", "region,skin"]);

    const definition = readDraftFile().stagedLock.engine.pieceDefinitions["character"];
    expect(definition.pathVariables).toEqual(["region", "skin"]);
  });

  it("rejects an unknown piece type", async () => {
    const { thrown } = await runEditDefinition(["ghost", "--draft", draftPath, "--strategy", "shared"]);
    expect(thrown).toBeUndefined(); // withErrorHandling swallows and sets exitCode instead
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("rejects a no-op call with no flags given", async () => {
    await runEditDefinition(["character", "--draft", draftPath]);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("--json replaces the full definition", async () => {
    const jsonPath = pathJoin(tempDir, "def.json");
    writeFileSync(jsonPath, JSON.stringify({
      selectionStrategy: "personal",
      requires: [],
      pathVariables: [],
      assets: [],
    }));

    await runEditDefinition(["character", "--draft", draftPath, "--json", jsonPath]);

    const definition = readDraftFile().stagedLock.engine.pieceDefinitions["character"];
    expect(definition.selectionStrategy).toBe("personal");
    expect(definition.assets).toEqual([]);
  });
});
