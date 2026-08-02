import { RosterLockV1Config, SelectedPiece } from "@roster-lock/types";

// A minimal but real config exercising a "personal" selection (each user
// picks independently, no merge script needed) where the picked piece has
// a mandatory nested requirement - enough to drive runSelection's roster
// validation and handleDownloads' recursive/deduped download resolution
// without needing untrusted-script execution.
export function makeLockConfig(): RosterLockV1Config {
  return {
    configIdentity: { namespace: "roster-lock", purpose: "lock", version: 1 },
    author: "test",
    title: "Test Config",
    version: "1.0.0",
    engine: {
      name: "test-engine",
      version: "1.0.0",
      pieceDefinitions: {
        character: {
          selectionStrategy: "personal",
          requires: ["weapon"],
          pathVariables: [],
          assets: [{ name: "model", classification: "media", count: 1, glob: ["model.glb"] }],
        },
        weapon: {
          selectionStrategy: "on demand",
          requires: [],
          pathVariables: [],
          assets: [{ name: "model", classification: "media", count: 1, glob: ["model.glb"] }],
        },
      },
    },
    rosters: {
      character: [{
        id: "hero-1",
        version: { logic: "1.0.0", media: "1.0.0", docs: "1.0.0" },
        humanInfo: { name: "Hero", author: "test", url: "http://example.com/hero" },
        downloadSources: ["http://example.com/hero.tar"],
        pathVariables: {},
        requiredPieces: { weapon: { expected: ["sword-1"], selectable: false } },
      }],
      weapon: [{
        id: "sword-1",
        version: { logic: "1.0.0", media: "1.0.0", docs: "1.0.0" },
        humanInfo: { name: "Sword", author: "test", url: "http://example.com/sword" },
        downloadSources: ["http://example.com/sword.tar"],
        pathVariables: {},
        requiredPieces: {},
      }],
    },
    mediaOverrides: {
      character: {
        "1.0.0": {
          "override-1.0.0": {
            name: "Alt Hero",
            assets: ["model"],
            downloadSources: ["http://example.com/alt-hero.tar"],
          },
        },
      },
    },
    selection: {
      piece: {
        character: {
          type: "normal",
          pieceMeta: { schema: {}, defaultMeta: {}, pieceMeta: {} },
          validation: { count: "*", unique: false, banList: [], customValidation: [] },
        },
      },
      globalValidation: [],
      scriptDictionary: {},
    },
  };
}

export function makeHeroSelection(): Record<string, Array<SelectedPiece>> {
  return {
    character: [{
      id: "hero-1",
      required: { weapon: { mandatory: [{ id: "sword-1", required: {} }], selectable: [] } },
    }],
  };
}

export function makeHeroSelectionWithMediaOverride(): Record<string, Array<SelectedPiece>> {
  return {
    character: [{
      id: "hero-1",
      mediaOverrides: ["override-1.0.0"],
      required: { weapon: { mandatory: [{ id: "sword-1", required: {} }], selectable: [] } },
    }],
  };
}
