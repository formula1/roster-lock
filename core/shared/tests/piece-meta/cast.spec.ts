import { describe, it, expect } from "vitest";

import { ROSTERLOCK_V1_PIECEMETADATA_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/piece-meta/index.js";

import pieceMetaJson from "./rosterlock.piece-meta.json";

describe("ROSTERLOCK_V1_PIECEMETADATA_CASTER_JSONSCHEMA", () => {
  it("casts a valid piece-meta JSON file", () => {
    const result = ROSTERLOCK_V1_PIECEMETADATA_CASTER_JSONSCHEMA.safeCast(pieceMetaJson);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.value.configIdentity.namespace).toBe("roster-lock");
    expect(result.value.configIdentity.purpose).toBe("piece-meta");
    expect(result.value.configIdentity.version).toBe(1);
    expect(result.value.humanInfo.name).toBe("Blue");
    expect(result.value.humanInfo.author).toBe("match-lock");
    expect(result.value.downloadSources).toEqual(["http://localhost:7342/pieces/character/blue.tar"]);
    expect(result.value.pathVariables).toEqual({});
  });
});
