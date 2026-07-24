import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

function buildLockWithPieceMeta(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: [],
    assets: [],
  };
  lock.rosters["character"] = [{
    id: "@author/blue",
    version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
    humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
    downloadSources: ["https://example.com/blue.tar"],
    pathVariables: {},
    requiredPieces: {},
  }];
  lock.selection.piece["character"] = {
    type: "unselectable",
  };
  lock.pieceMeta["character"] = {
    schema: { power: "number" },
    defaultMeta: { power: 1 },
    values: { "@author/blue": { power: 5 } },
  };
  return lock;
}

describe("piece meta validation", () => {
  it("accepts default meta and per-piece meta that match the declared schema", () => {
    const lock = buildLockWithPieceMeta();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects default meta missing a required schema key", () => {
    const lock = buildLockWithPieceMeta();
    lock.pieceMeta["character"].defaultMeta = {};

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /must have all required keys/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects per-piece meta for a piece that isn't in the roster", () => {
    const lock = buildLockWithPieceMeta();
    lock.pieceMeta["character"].values = { "@author/missing": { power: 2 } };

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /not in the roster/i.test(e.message ?? ""))).toBe(true);
  });
});
