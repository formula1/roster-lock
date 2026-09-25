import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { RosterLockV1Config } from "@roster-lock/types";
import {
  assertSupportedTeamMode, resolveOfficialTeamMode, validateSelectionCount, validateGameConfig,
} from "../src/selectionValidation";

const EXAMPLE_DIR = join(__dirname, "../../../../examples/mugen/roster-locks");
const DRAFT_PATH = join(EXAMPLE_DIR, "mugen.rosterlock.draft.json");
const draftRosterConfig: RosterLockV1Config = JSON.parse(readFileSync(DRAFT_PATH, "utf-8")).stagedLock;

function loadLock(mode: string): RosterLockV1Config {
  return JSON.parse(readFileSync(join(EXAMPLE_DIR, `mugen-${mode}.roster-lock.json`), "utf-8"));
}

function validGameConfig(overrides: Partial<{ teamMode: string, roundTime: number, rounds: number }> = {}) {
  return { teamMode: "tag", roundTime: -1, rounds: 3, ...overrides };
}

describe("assertSupportedTeamMode", () => {
  it("passes single/tag/turns through without throwing", () => {
    for(const mode of ["single", "tag", "turns"]) expect(() => assertSupportedTeamMode(mode)).not.toThrow();
  });

  it("names \"simul\" specifically as unsupported, not just unrecognized", () => {
    expect(() => assertSupportedTeamMode("simul")).toThrow(/doesn't support "simul" team mode yet/);
  });

  it("rejects anything that isn't an Ikemen team mode at all", () => {
    expect(() => assertSupportedTeamMode("battle-royale")).toThrow(/isn't a team mode ikemen-go recognizes/);
  });
});

describe("resolveOfficialTeamMode", () => {
  it("resolves a tag from engine.officialSelections", async () => {
    await expect(resolveOfficialTeamMode(loadLock("tag"))).resolves.toBe("tag");
    await expect(resolveOfficialTeamMode(loadLock("turns"))).resolves.toBe("turns");
    await expect(resolveOfficialTeamMode(loadLock("single"))).resolves.toBe("single");
  });

  it("throws for a selection config officially tagged \"simul\"", async () => {
    await expect(resolveOfficialTeamMode(loadLock("simul"))).rejects.toThrow(/doesn't support "simul"/);
  });

  it("returns undefined for an untagged custom selection config", async () => {
    const config = JSON.parse(JSON.stringify(draftRosterConfig)) as RosterLockV1Config;
    config.selection.piece.character.validation.count = [1, 2];
    await expect(resolveOfficialTeamMode(config)).resolves.toBeUndefined();
  });
});

describe("validateSelectionCount", () => {
  it("rejects a selection config allowing more than 1 character under \"single\"", () => {
    expect(validateSelectionCount("single", 3)).toEqual([
      expect.stringMatching(/"single" team mode expects exactly 1 character.*allows 3/),
    ]);
    expect(validateSelectionCount("single", [1, 3])).toEqual([expect.stringMatching(/"single"/)]);
  });

  it("accepts exactly 1 for \"single\"", () => {
    expect(validateSelectionCount("single", 1)).toEqual([]);
  });

  it("accepts anything within 1-4 for \"tag\"/\"turns\"", () => {
    expect(validateSelectionCount("tag", 3)).toEqual([]);
    expect(validateSelectionCount("turns", [1, 4])).toEqual([]);
  });

  it("rejects a \"tag\"/\"turns\" config that could exceed the 4-character cap", () => {
    expect(validateSelectionCount("tag", [1, 5])).toEqual([expect.stringMatching(/"tag"/)]);
    expect(validateSelectionCount("turns", "*")).toEqual([expect.stringMatching(/"turns"/)]);
  });
});

describe("validateGameConfig", () => {
  it("flags a single + 3-character selection config as incompatible", async () => {
    const config = JSON.parse(JSON.stringify(draftRosterConfig)) as RosterLockV1Config;
    config.selection.piece.character.validation.count = 3;
    const problems = await validateGameConfig(validGameConfig({ teamMode: "single" }), config);
    expect(problems).toEqual([expect.stringMatching(/"single" team mode expects exactly 1 character/)]);
  });

  it("accepts tag/turns within the selection config's declared range", async () => {
    expect(await validateGameConfig(validGameConfig(), loadLock("tag"))).toEqual([]);
    expect(await validateGameConfig(validGameConfig({ teamMode: "turns" }), loadLock("turns"))).toEqual([]);
  });

  it("rejects \"simul\" as a gameConfig override without throwing", async () => {
    const problems = await validateGameConfig(validGameConfig({ teamMode: "simul" }), loadLock("tag"));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /teamMode/.test(p))).toBe(true);
  });

  it("rejects a selection config officially tagged \"simul\" without throwing", async () => {
    const { teamMode: _omit, ...rest } = validGameConfig();
    const problems = await validateGameConfig(rest, loadLock("simul"));
    expect(problems.some((p) => /doesn't support "simul"/.test(p))).toBe(true);
  });

  it("reports schema problems: missing rounds, wrong type for roundTime, bad teamMode enum", async () => {
    const config = loadLock("tag");
    expect(await validateGameConfig({ teamMode: "tag", roundTime: -1 }, config))
      .toEqual([expect.stringMatching(/rounds/)]);
    expect(await validateGameConfig(validGameConfig({ roundTime: "forever" as unknown as number }), config))
      .toEqual([expect.stringMatching(/roundTime/)]);
    expect(await validateGameConfig(validGameConfig({ teamMode: "not-a-mode" }), config))
      .toEqual([expect.stringMatching(/teamMode/)]);
  });

  it("returns no problems for an untagged custom selection config with no override", async () => {
    const config = JSON.parse(JSON.stringify(draftRosterConfig)) as RosterLockV1Config;
    config.selection.piece.character.validation.count = [1, 2];
    const { teamMode: _omit, ...rest } = validGameConfig();
    // teamMode is required by the schema, so this still reports that one schema problem, but
    // nothing about the (unresolvable) semantic check.
    const problems = await validateGameConfig(rest, config);
    expect(problems.every((p) => !/team mode/.test(p))).toBe(true);
  });
});
