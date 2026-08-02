import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config, SelectedPiece } from "@roster-lock/types";

import { ensurePiecesAreInRoster } from "../../src/match-lock-file/match-config/version-1/usage/validate-select/ensure-pieces-are-in-roster.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";

const LOGIC_HASH = "a".repeat(64);

function buildConfig(): RosterLockV1Config {
  const lock = cloneJSON(EMPTY_ROSTER_LOCK);
  lock.engine.pieceDefinitions["character"] = {
    selectionStrategy: "personal",
    requires: [],
    pathVariables: [],
    assets: [
      { name: "sprite", classification: "media", count: 1, glob: ["sprite.png"] },
      { name: "sound", classification: "media", count: 1, glob: ["sound.wav"] },
    ],
  };
  lock.rosters["character"] = [{
    id: "hero-1",
    version: { logic: LOGIC_HASH, media: "b".repeat(64), docs: "c".repeat(64) },
    humanInfo: { name: "Hero", author: "test", url: "https://example.com/hero" },
    downloadSources: ["https://example.com/hero.tar"],
    pathVariables: {},
    requiredPieces: {},
  }];
  lock.mediaOverrides["character"] = {
    [LOGIC_HASH]: {
      [`${"d".repeat(63)}1`]: { name: "Alt Sprite", assets: ["sprite"], downloadSources: ["https://example.com/sprite.tar"] },
      [`${"d".repeat(63)}2`]: { name: "Alt Sound", assets: ["sound"], downloadSources: ["https://example.com/sound.tar"] },
    },
  };
  return lock;
}

function selection(mediaOverrides?: Array<string>): Array<SelectedPiece> {
  return [{ id: "hero-1", mediaOverrides, required: {} }];
}

describe("ensurePiecesAreInRoster - mediaOverrides", () => {
  it("accepts a piece with no mediaOverrides selected", () => {
    const config = buildConfig();
    expect(() => ensurePiecesAreInRoster(config, "character", selection())).not.toThrow();
  });

  it("accepts multiple selected overrides whose assets don't conflict", () => {
    const config = buildConfig();
    const hashes = Object.keys(config.mediaOverrides["character"][LOGIC_HASH]);
    expect(() => ensurePiecesAreInRoster(config, "character", selection(hashes))).not.toThrow();
  });

  it("rejects a selected override hash that isn't declared for the piece", () => {
    const config = buildConfig();
    expect(() => ensurePiecesAreInRoster(config, "character", selection(["f".repeat(64)])))
      .toThrow(/selected unknown mediaOverride/);
  });

  it("rejects two selected overrides that both claim the same asset", () => {
    const config = buildConfig();
    const [firstHash] = Object.keys(config.mediaOverrides["character"][LOGIC_HASH]);
    const conflictingHash = "e".repeat(64);
    config.mediaOverrides["character"][LOGIC_HASH][conflictingHash] = {
      name: "Also Alt Sprite", assets: ["sprite"], downloadSources: ["https://example.com/sprite2.tar"],
    };
    expect(() => ensurePiecesAreInRoster(config, "character", selection([firstHash, conflictingHash])))
      .toThrow(/both claim asset/);
  });

  it("rejects a duplicate override hash in the same selection", () => {
    const config = buildConfig();
    const [firstHash] = Object.keys(config.mediaOverrides["character"][LOGIC_HASH]);
    expect(() => ensurePiecesAreInRoster(config, "character", selection([firstHash, firstHash])))
      .toThrow(/duplicate mediaOverrides/);
  });
});
