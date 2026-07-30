import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

function buildLockWithRequiresPiece(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: ["hat"],
    pathVariables: [],
    assets: [],
  };
  lock.engine.pieceDefinitions["hat"] = {
    selectionStrategy: "on demand",
    requires: [],
    pathVariables: [],
    assets: [],
  };
  lock.rosters["character"] = [];
  lock.rosters["hat"] = [];
  return lock;
}

describe("engine piece requirements validation", () => {
  it("accepts a piece that requires an on-demand piece with no cycle", () => {
    const lock = buildLockWithRequiresPiece();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects piece types whose requirements form a cycle", () => {
    const lock = buildLockWithRequiresPiece();
    lock.engine.pieceDefinitions["character"].selectionStrategy = "on demand";
    lock.engine.pieceDefinitions["hat"].requires = ["character"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /form a cycle/i.test(e.message ?? ""))).toBe(true);
  });
});
