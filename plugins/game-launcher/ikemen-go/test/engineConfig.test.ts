import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { RosterLockV1Config } from "@roster-lock/types";
import { IKEMEN_ENGINE_PIECE_DEFINITIONS, IKEMEN_ENGINE_SHA } from "../src/engineConfig";
import { syncSha256FromJSON } from "../src/hash";

// examples/mugen/roster-locks is built by examples/mugen/build-draft.sh, which
// drives config-editor-cli's CLI surface piece-by-piece rather than importing
// this file - it's meant to look like what a real engine-config author would
// run. This test is what keeps that hand-authored script and this plugin's
// own IKEMEN_ENGINE_PIECE_DEFINITIONS from drifting apart: if someone changes
// one without the other, engineSha would stop matching the example (and every
// real MUGEN roster built the same way), silently.
const mugenLock: RosterLockV1Config = JSON.parse(
  readFileSync(join(__dirname, "../../../../examples/mugen/roster-locks/mugen-single.roster-lock.json"), "utf-8")
);

// titled-room's admin UI reads engineSha off this plugin's *published*
// package.json (see titled-room/src/admin/npm-registry.ts) rather than
// trusting an admin to type it in - so package.json's "roster-lock".engineSha
// has to be updated by hand alongside engineConfig.ts. This test is what
// catches the two drifting apart, same as the pieceDefinitions check above.
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

describe("IKEMEN_ENGINE_PIECE_DEFINITIONS", () => {
  it("matches examples/mugen's published engine.pieceDefinitions exactly", () => {
    expect(IKEMEN_ENGINE_PIECE_DEFINITIONS).toEqual(mugenLock.engine.pieceDefinitions);
  });

  it("is what engineSha is computed from - matches the mugen example's own hash", () => {
    expect(IKEMEN_ENGINE_SHA).toBe(syncSha256FromJSON(mugenLock.engine.pieceDefinitions));
  });

  it("is a real sha256 hex digest", () => {
    expect(IKEMEN_ENGINE_SHA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches package.json's published roster-lock.engineSha", () => {
    expect(packageJson["roster-lock"].engineSha).toBe(IKEMEN_ENGINE_SHA);
  });
});
