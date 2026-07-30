import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

function buildLockWithPathVariablePiece(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: ["skin"],
    assets: [{ name: "sprite", classification: "media", count: 1, glob: ["{skin}/*.png"] }],
  };
  lock.rosters["character"] = [{
    id: "@author/blue",
    version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
    humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
    downloadSources: ["https://example.com/blue.tar"],
    pathVariables: { skin: "blue" },
    requiredPieces: {},
  }];
  return lock;
}

describe("roster piece pathVariables validation", () => {
  it("accepts a piece whose pathVariables match the piece type's declared names", () => {
    const lock = buildLockWithPathVariablePiece();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects a piece missing a required path variable", () => {
    const lock = buildLockWithPathVariablePiece();
    lock.rosters["character"][0].pathVariables = {};

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /missing value for path variable/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects a piece with a path variable name the piece type doesn't declare", () => {
    const lock = buildLockWithPathVariablePiece();
    lock.rosters["character"][0].pathVariables = { skin: "blue", region: "eu" };

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /does not have path variable/i.test(e.message ?? ""))).toBe(true);
  });
});
