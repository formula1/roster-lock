import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

const LOGIC_HASH = "a".repeat(64);
const OVERRIDE_HASH = "d".repeat(64);

function buildLockWithCharacter(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: [],
    assets: [
      { name: "sprite", classification: "media", count: 1, glob: ["sprite.png"] },
      { name: "sound", classification: "media", count: 1, glob: ["sound.wav"] },
      { name: "logic", classification: "logic", count: 1, glob: ["logic.js"] },
    ],
  };
  lock.rosters["character"] = [{
    id: "@author/blue",
    version: { logic: LOGIC_HASH, media: "b".repeat(64), docs: "c".repeat(64) },
    humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
    downloadSources: ["https://example.com/blue.tar"],
    pathVariables: {},
    requiredPieces: {},
  }];
  return lock;
}

function buildLockWithOverride(): RosterLockV1Config {
  const lock = buildLockWithCharacter();
  lock.mediaOverrides["character"] = {
    [LOGIC_HASH]: {
      [OVERRIDE_HASH]: {
        name: "Alt Sprite",
        assets: ["sprite"],
        downloadSources: ["https://example.com/alt-sprite.tar"],
      },
    },
  };
  return lock;
}

describe("mediaOverrides validation", () => {
  it("accepts a config with no mediaOverrides field at all", () => {
    const lock = buildLockWithCharacter();
    delete (lock as Partial<RosterLockV1Config>).mediaOverrides;
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("accepts a well-formed media override on an existing piece's logic hash", () => {
    const lock = buildLockWithOverride();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects an override under a pieceType not defined in the engine", () => {
    const lock = buildLockWithOverride();
    lock.mediaOverrides["ghost-type"] = lock.mediaOverrides["character"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /not defined in engine/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an override whose logic hash doesn't match any roster piece", () => {
    const lock = buildLockWithOverride();
    const unknownLogic = "f".repeat(64);
    lock.mediaOverrides["character"][unknownLogic] = lock.mediaOverrides["character"][LOGIC_HASH];
    delete lock.mediaOverrides["character"][LOGIC_HASH];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /no piece of type/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an override that references an asset the piece type doesn't define", () => {
    const lock = buildLockWithOverride();
    lock.mediaOverrides["character"][LOGIC_HASH][OVERRIDE_HASH].assets = ["nonexistent"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /is not defined for piece type/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an override that references a non-media (logic) asset", () => {
    const lock = buildLockWithOverride();
    lock.mediaOverrides["character"][LOGIC_HASH][OVERRIDE_HASH].assets = ["logic"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /media overrides can only reference "media" assets/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an override with duplicate asset names", () => {
    const lock = buildLockWithOverride();
    lock.mediaOverrides["character"][LOGIC_HASH][OVERRIDE_HASH].assets = ["sprite", "sprite"];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /duplicate asset/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects an override with no download sources", () => {
    const lock = buildLockWithOverride();
    lock.mediaOverrides["character"][LOGIC_HASH][OVERRIDE_HASH].downloadSources = [];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /expecting at least 1 source/i.test(e.message ?? ""))).toBe(true);
  });
});
