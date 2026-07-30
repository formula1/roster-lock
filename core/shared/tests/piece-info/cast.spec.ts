import { describe, it, expect } from "vitest";

import { ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/piece-info/index.js";

import pieceInfoJson from "./rosterlock.piece-info.json";

describe("ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA", () => {
  it("casts a valid piece-info JSON file", () => {
    const result = ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA.safeCast(pieceInfoJson);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.value.configIdentity.namespace).toBe("roster-lock");
    expect(result.value.configIdentity.purpose).toBe("piece-info");
    expect(result.value.configIdentity.version).toBe(1);
    expect(result.value.humanInfo.name).toBe("Blue");
    expect(result.value.humanInfo.author).toBe("match-lock");
    expect(result.value.downloadSources).toEqual(["http://localhost:7342/pieces/character/blue.tar"]);
    expect(result.value.pathVariables).toEqual({});
  });
});
