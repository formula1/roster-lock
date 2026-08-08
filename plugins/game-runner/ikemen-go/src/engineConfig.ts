import { RosterLockEngineConfig } from "@roster-lock/types";
import { CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE } from "./pieceTypes";
import { syncSha256FromJSON } from "./hash";

// The pieceDefinitions this plugin needs a roster's engine config to match,
// exactly (see engineSha below) - not just "character" and "stage" existing,
// but declaring the same defName path variable and the same asset shape.
//
// This is the thing general-plan.md calls comparing "the Game Runner's Engine
// Sha with the Roster Config Engine Sha": before a room can be created, the
// roster's engine.pieceDefinitions has to be byte-identical to this, or
// buildArgs.ts's assumptions (a single <defName>.def, and everything Ikemen
// needs actually downloaded alongside it) don't hold.
//
// It's scoped to pieceDefinitions only - not engine.name/version (cosmetic,
// roster-author-chosen) or engine.officialSelections (roster-specific: a
// modded roster adding a "5v5" mode shouldn't stop matching this plugin).
//
// Deliberately kept in lockstep with examples/mugen/roster-locks/build-draft.sh
// by a test (test/engineConfig.test.ts) rather than by the build script
// importing this file - the script drives config-editor-cli's CLI surface
// piece by piece (the same way a real engine-config author would), and the
// test is what catches the two drifting apart.
export const IKEMEN_ENGINE_PIECE_DEFINITIONS: RosterLockEngineConfig["pieceDefinitions"] = {
  [CHARACTER_PIECE_TYPE]: {
    selectionStrategy: "personal",
    requires: [],
    pathVariables: [DEF_NAME_VARIABLE],
    assets: [
      // Exactly one file is *the* character def - see pieceTypes.ts on why
      // that can't be found by globbing for "the one .def" instead.
      { name: "definition", classification: "logic", count: 1, glob: [`<${DEF_NAME_VARIABLE}>.def`] },
      // intro/ending storyboards are their own .def files in the same folder,
      // resolved by Ikemen out of the character's own def - present in some
      // characters (kfm), absent in others (Baiken).
      { name: "storyboards", classification: "logic", count: [0, "*"], glob: ["intro.def", "ending.def"] },
      {
        name: "states", classification: "logic", count: [1, "*"],
        glob: ["**/*.cns", "**/*.cmd", "**/*.air", "**/*.const", "**/*.zss"],
      },
      { name: "movelist", classification: "logic", count: [0, "*"], glob: ["movelist.dat"] },
      { name: "sprites", classification: "media", count: [1, "*"], glob: ["**/*.sff"] },
      { name: "sounds", classification: "media", count: [0, "*"], glob: ["**/*.snd"] },
      { name: "palettes", classification: "media", count: [0, "*"], glob: ["**/*.act", "**/*.png", "**/*.bmp"] },
      { name: "docs", classification: "doc", count: [0, "*"], glob: ["**/*.txt"] },
    ],
  },
  [STAGE_PIECE_TYPE]: {
    selectionStrategy: "shared",
    requires: [],
    pathVariables: [DEF_NAME_VARIABLE],
    assets: [
      { name: "definition", classification: "logic", count: 1, glob: [`<${DEF_NAME_VARIABLE}>.def`] },
      { name: "sprites", classification: "media", count: [1, "*"], glob: ["**/*.sff"] },
    ],
  },
};

export const IKEMEN_ENGINE_SHA = syncSha256FromJSON(IKEMEN_ENGINE_PIECE_DEFINITIONS);
