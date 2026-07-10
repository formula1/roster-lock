import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

function buildLockWithAssetPiece(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: ["skin"],
    assets: [{ name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] }],
  };
  lock.rosters["character"] = [];
  return lock;
}

describe("engine piece assets validation", () => {
  it("accepts a piece whose asset names are unique and globs use declared path variables", () => {
    const lock = buildLockWithAssetPiece();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects a piece with a duplicate asset name", () => {
    const lock = buildLockWithAssetPiece();
    lock.engine.pieceDefinitions["character"].assets.push(
      { name: "sprite", classification: "media", count: 1, glob: ["other/*.png"] }
    );

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /duplicate name/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an asset glob referencing a path variable the piece type doesn't declare", () => {
    const lock = buildLockWithAssetPiece();
    lock.engine.pieceDefinitions["character"].assets[0].glob = ["<region>/*.png"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /undefined path variable/i.test(e.message ?? ""))).toBe(true);
  });
});
