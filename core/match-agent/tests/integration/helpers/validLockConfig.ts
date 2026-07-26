import { createHash } from "node:crypto";
import { RosterLockV1Config, SelectedPiece } from "@roster-lock/types";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

// makeLockConfig() (lockConfig.ts) is shaped for bindStepsToBridge tests,
// which never runs it through ROSTERLOCK_V1_CASTER_JSONSCHEMA (the AJV
// schema match-agent's HTTP routes validate lockConfig bodies against,
// e.g. piece-sort.ts) - that schema requires real sha256 hex hashes and
// https:// urls, which makeLockConfig()'s "1.0.0"/http:// fixtures fail.
// This is the same shape, just with values that pass that schema too.
export function makeValidLockConfig(): RosterLockV1Config {
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
        version: { logic: sha256("hero-1-logic"), media: sha256("hero-1-media"), docs: sha256("hero-1-docs") },
        humanInfo: { name: "Hero", author: "test", url: "https://example.com/hero" },
        downloadSources: ["https://example.com/hero.tar"],
        pathVariables: {},
        requiredPieces: { weapon: { expected: ["sword-1"], selectable: false } },
      }],
      weapon: [{
        id: "sword-1",
        version: { logic: sha256("sword-1-logic"), media: sha256("sword-1-media"), docs: sha256("sword-1-docs") },
        humanInfo: { name: "Sword", author: "test", url: "https://example.com/sword" },
        downloadSources: ["https://example.com/sword.tar"],
        pathVariables: {},
        requiredPieces: {},
      }],
    },
    selection: {
      piece: {
        character: {
          type: "normal",
          validation: { count: "*", unique: false, banList: [], customValidation: [] },
        },
      },
      globalValidation: [],
      scriptDictionary: {},
    },
    pieceMeta: {
      character: { schema: {}, defaultMeta: {}, values: {} },
      weapon: { schema: {}, defaultMeta: {}, values: {} },
    },
  };
}

export function makeValidHeroSelection(): Record<string, Array<SelectedPiece>> {
  return {
    character: [{
      id: "hero-1",
      required: { weapon: { mandatory: [{ id: "sword-1", required: {} }], selectable: [] } },
    }],
  };
}
