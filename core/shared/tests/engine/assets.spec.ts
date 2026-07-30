import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";

import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/lock/index.js";
import { EMPTY_ROSTER_LOCK } from "../../src/match-lock-file/match-config/version-1/usage/empty-configs.js";
import { getMatchingAssetsForFile } from "../../src/match-lock-file/match-config/version-1/usage/files-and-assets/getMatchingAsset.js";
import { PieceDefinition } from "../../src/match-lock-file/match-config/version-1/usage/files-and-assets/types.js";

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

function buildPieceDefinition(
  pathVariables: PieceDefinition["pathVariables"],
  assets: PieceDefinition["assets"],
): PieceDefinition {
  return { selectionStrategy: "mandatory", requires: [], pathVariables, assets };
}

describe("getMatchingAssetsForFile path variables and globs", () => {
  it("matches a glob once its path variable is substituted with the roster's value", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] },
    ]);
    const matches = getMatchingAssetsForFile(piece, { skin: "blue" }, "blue/idle.png");
    expect(matches.map((a) => a.name)).toEqual(["sprite"]);
  });

  it("does not match when the file's path segment differs from the path variable's value", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] },
    ]);
    expect(getMatchingAssetsForFile(piece, { skin: "blue" }, "red/idle.png")).toEqual([]);
  });

  it("matches a path variable used inside a filename, not just a directory segment", () => {
    // Ikemen-Go style character defs, e.g. "<character>.def"
    const piece = buildPieceDefinition(["character"], [
      { name: "def-file", classification: "logic", count: 1, glob: ["<character>.def"] },
    ]);
    expect(getMatchingAssetsForFile(piece, { character: "kfm" }, "kfm.def").map((a) => a.name))
      .toEqual(["def-file"]);
    expect(getMatchingAssetsForFile(piece, { character: "kfm" }, "ryu.def")).toEqual([]);
  });

  it("resolves multiple path variables combined with a globstar across nested directories", () => {
    const piece = buildPieceDefinition(["character", "skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<character>/<skin>/**/*.png"] },
    ]);
    const pathVariables = { character: "kfm", skin: "default" };
    expect(getMatchingAssetsForFile(piece, pathVariables, "kfm/default/stance/1.png").length).toBe(1);
    expect(getMatchingAssetsForFile(piece, pathVariables, "kfm/other/stance/1.png")).toEqual([]);
    expect(getMatchingAssetsForFile(piece, pathVariables, "other/default/stance/1.png")).toEqual([]);
  });

  it("matches an asset if any of its globs match, mixing a literal glob with a path-variable glob", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["portrait.png", "<skin>/*.png"] },
    ]);
    expect(getMatchingAssetsForFile(piece, { skin: "blue" }, "portrait.png").map((a) => a.name))
      .toEqual(["sprite"]);
    expect(getMatchingAssetsForFile(piece, { skin: "blue" }, "blue/idle.png").map((a) => a.name))
      .toEqual(["sprite"]);
    expect(getMatchingAssetsForFile(piece, { skin: "blue" }, "red/idle.png")).toEqual([]);
  });

  it("matches via exact equality when the glob has no wildcard characters", () => {
    const piece = buildPieceDefinition([], [
      { name: "portrait", classification: "media", count: 1, glob: ["assets/portrait.png"] },
    ]);
    expect(getMatchingAssetsForFile(piece, {}, "assets/portrait.png").map((a) => a.name))
      .toEqual(["portrait"]);
  });

  it("allows path variable values containing spaces", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] },
    ]);
    expect(getMatchingAssetsForFile(piece, { skin: "light blue" }, "light blue/idle.png").map((a) => a.name))
      .toEqual(["sprite"]);
  });

  it("returns every asset whose glob matches, when globs overlap", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "any-png", classification: "media", count: 1, glob: ["<skin>/*.png"] },
      { name: "idle-png", classification: "media", count: 1, glob: ["<skin>/idle.png"] },
    ]);
    const matches = getMatchingAssetsForFile(piece, { skin: "blue" }, "blue/idle.png");
    expect(matches.map((a) => a.name).sort()).toEqual(["any-png", "idle-png"]);
  });

  it("throws instead of matching when a path variable value contains disallowed characters", () => {
    // Guards against path variable values being used to smuggle glob/traversal syntax into the pattern
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] },
    ]);
    expect(() => getMatchingAssetsForFile(piece, { skin: "../etc" }, "../etc/idle.png"))
      .toThrow(/invalid characters/i);
    expect(() => getMatchingAssetsForFile(piece, { skin: "*" }, "*/idle.png"))
      .toThrow(/invalid characters/i);
  });

  it("throws when a path variable value is empty", () => {
    const piece = buildPieceDefinition(["skin"], [
      { name: "sprite", classification: "media", count: 1, glob: ["<skin>/*.png"] },
    ]);
    expect(() => getMatchingAssetsForFile(piece, { skin: "" }, "idle.png")).toThrow(/too short/i);
  });
});
