import { describe, it, expect } from "vitest";
import { cloneJSON } from "@roster-lock/utils";

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

  it("accepts humanInfo.image explicitly set to null", () => {
    // Same nullable() regression check as officialSelections - image also
    // carries the imageDataURI custom keyword, so this also confirms the
    // keyword correctly doesn't run against the null branch.
    const withNullImage = cloneJSON(pieceInfoJson) as typeof pieceInfoJson & {
      humanInfo: { image?: string | null };
    };
    withNullImage.humanInfo.image = null;

    const result = ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA.safeCast(withNullImage);
    expect(result.valid).toBe(true);
  });

  it("rejects humanInfo.image set to a non-data-URI string", () => {
    const withBadImage = cloneJSON(pieceInfoJson);
    withBadImage.humanInfo.image = "not-a-data-uri";

    const result = ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA.safeCast(withBadImage);
    expect(result.valid).toBe(false);
  });
});
