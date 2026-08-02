import { describe, it, expect } from "vitest";

import { calculateMediaOverrideVersion } from "../../src/match-lock-file/match-config/version-1/usage/calculatePieceVersion.js";

function fileGetterFor(contents: Record<string, string>){
  return async (path: string) => {
    const bytes = new TextEncoder().encode(contents[path]);
    return {
      byteSize: bytes.byteLength,
      stream: (async function* (){ yield bytes; })(),
    };
  };
}

describe("calculateMediaOverrideVersion", () => {
  it("is independent of the input Map's insertion order", async () => {
    const contents = { "sprite.png": "sprite-bytes", "sprite2.png": "sprite2-bytes" };
    const getFile = fileGetterFor(contents);

    const forward = new Map([["sprite.png", {}], ["sprite2.png", {}]]);
    const reversed = new Map([["sprite2.png", {}], ["sprite.png", {}]]);

    const hashForward = await calculateMediaOverrideVersion(forward, getFile);
    const hashReversed = await calculateMediaOverrideVersion(reversed, getFile);

    expect(hashForward).toBe(hashReversed);
  });

  it("changes when a file's contents change", async () => {
    const files = new Map([["sprite.png", {}]]);

    const hashA = await calculateMediaOverrideVersion(files, fileGetterFor({ "sprite.png": "version-a" }));
    const hashB = await calculateMediaOverrideVersion(files, fileGetterFor({ "sprite.png": "version-b" }));

    expect(hashA).not.toBe(hashB);
  });

  it("returns a stable hash for an empty file set", async () => {
    const hash = await calculateMediaOverrideVersion(new Map(), fileGetterFor({}));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
