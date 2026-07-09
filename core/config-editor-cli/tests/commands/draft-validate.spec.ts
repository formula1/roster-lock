import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Draft } from "@roster-lock/types";
import { draftValidateCommand } from "../../src/commands/draft/validate";

async function runValidate(draftPath: string){
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  process.exitCode = undefined;

  await draftValidateCommand.parseAsync(["node", "draft-validate", "--draft", draftPath]);

  const result = {
    exitCode: process.exitCode,
    logs: logSpy.mock.calls.map((call) => call.join(" ")),
    errors: errorSpy.mock.calls.map((call) => call.join(" ")),
  };
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.exitCode = undefined;
  return result;
}

describe("draft validate", () => {
  let tempDir: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-draft-validate-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeDraftFixture(draft: RosterLockV1Draft){
    writeFileSync(draftPath, JSON.stringify(draft));
  }

  it("reports OK and exit code 0 for a valid (empty) staged lock", async () => {
    writeDraftFixture(cloneJSON(EMPTY_ROSTER_DRAFT));

    const { exitCode, logs } = await runValidate(draftPath);

    expect(exitCode).toBeUndefined();
    expect(logs.join("\n")).toMatch(/OK/);
  });

  it("reports every issue at once for an invalid staged lock, not just the first", async () => {
    const draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = {
      selectionStrategy: "mandatory",
      requires: ["missing-type"],
      pathVariables: [],
      assets: [
        { name: "sprite", classification: "media", count: 1, glob: ["*.png"] },
        { name: "sprite", classification: "media", count: 1, glob: ["*.jpg"] },
      ],
    };
    draft.stagedLock.rosters["character"] = [];
    writeDraftFixture(draft);

    const { exitCode, errors } = await runValidate(draftPath);
    const output = errors.join("\n");

    expect(exitCode).toBe(1);
    // A single first-error-only validator would stop after the "requires" issue;
    // both requirement AND duplicate-asset-name issues must be present together.
    expect(output).toMatch(/missing-type/);
    expect(output).toMatch(/Duplicate name/);
    expect((output.match(/Duplicate name/g) ?? []).length).toBe(2);
  });

  it("propagates draft-resolution errors (e.g. missing draft file) via formatError", async () => {
    const { exitCode, errors } = await runValidate(pathJoin(tempDir, "does-not-exist.rosterlock.draft.json"));

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toMatch(/ENOENT|no such file/i);
  });
});
