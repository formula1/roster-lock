import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

function buildLock(): RosterLockV1Config {
  return cloneJSON(EMPTY_ROSTER_LOCK);
}

describe("engine officialSelections validation", () => {
  it("is optional - a lock with no officialSelections is still valid", () => {
    const lock = buildLock();
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("accepts a list of tagged, unique, well-formed hashes", () => {
    const lock = buildLock();
    lock.engine.officialSelections = [
      { tag: "3v3-tag-team", hash: "a".repeat(64) },
      { tag: "1v1", hash: "b".repeat(64) },
    ];
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects a hash that isn't a 64-char hex string", () => {
    const lock = buildLock();
    lock.engine.officialSelections = [{ tag: "1v1", hash: "not-a-hash" }];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /not a valid SHA-256/i.test(e.message ?? ""))).toBe(true);
  });

  it("rejects two entries sharing the same hash, even under different tags", () => {
    const lock = buildLock();
    const hash = "a".repeat(64);
    lock.engine.officialSelections = [
      { tag: "3v3-tag-team", hash },
      { tag: "3v3-tag-team-v2", hash },
    ];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
    if(result.valid) return;
    expect(result.error.some((e) => /duplicate official selection hash/i.test(e.message ?? ""))).toBe(true);
  });

  it("allows two entries sharing the same tag with different hashes (a revision under the same UI screen)", () => {
    const lock = buildLock();
    lock.engine.officialSelections = [
      { tag: "3v3-tag-team", hash: "a".repeat(64) },
      { tag: "3v3-tag-team", hash: "b".repeat(64) },
    ];
    expect(() => ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock)).not.toThrow();
  });

  it("rejects an entry missing a tag", () => {
    const lock = buildLock();
    lock.engine.officialSelections = [{ hash: "a".repeat(64) } as any];

    const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock);
    expect(result.valid).toBe(false);
  });
});
