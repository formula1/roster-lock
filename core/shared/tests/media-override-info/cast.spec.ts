import { describe, it, expect } from "vitest";

import { ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA } from "../../src/match-lock-file/match-config/version-1/media-override-info/index.js";

import mediaOverrideInfoJson from "./rosterlock.media-override-info.json";

describe("ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA", () => {
  it("casts a valid media-override-info JSON file", () => {
    const result = ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA.safeCast(mediaOverrideInfoJson);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.value.configIdentity.namespace).toBe("roster-lock");
    expect(result.value.configIdentity.purpose).toBe("media-override-info");
    expect(result.value.configIdentity.version).toBe(1);
    expect(result.value.name).toBe("Alt Sprite");
    expect(result.value.assets).toEqual(["sprite"]);
    expect(result.value.downloadSources).toEqual(["http://localhost:7342/media-overrides/character/alt-sprite.tar"]);
  });
});
