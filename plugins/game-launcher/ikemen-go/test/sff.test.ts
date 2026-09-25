import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeSpriteToPng } from "../src/sff";
import { decodePng } from "../src/sff/png";

// Real fixtures bundled with examples/mugen - same fixture-access convention
// as buildArgs.test.ts/engineConfig.test.ts (a plain relative readFileSync,
// no copy into this package's own test/ folder).
const PIECES_DIR = join(__dirname, "../../../../examples/mugen/pieces");

function loadSff(relativePath: string): Buffer {
  return readFileSync(join(PIECES_DIR, relativePath));
}

// Asserts the decoded PNG has the right dimensions and isn't degenerate
// (e.g. every pixel identical) - the only sanity check possible without an
// independent SFF decoder to diff against (see docs/plan notes on format 2/4).
function expectPlausiblePortrait(png: Buffer, expectedWidth: number, expectedHeight: number) {
  const decoded = decodePng(png);
  expect(decoded.width).toBe(expectedWidth);
  expect(decoded.height).toBe(expectedHeight);
  const first = decoded.pixels[0];
  expect(decoded.pixels.some((b) => b !== first)).toBe(true);
}

describe("decodeSpriteToPng", () => {
  it("decodes a format 10 (embedded PNG8) sprite", () => {
    // kfm_zss's 9000,1 is confirmed (by hand, via the original
    // extract-sff-sprite.js script) to be a 120x140 format-10 sprite.
    const buf = loadSff("chars/kfm_zss/kfm.sff");
    const png = decodeSpriteToPng(buf, 9000, 1);
    expectPlausiblePortrait(png, 120, 140);
  });

  it("decodes a format 4 (LZ5) sprite - kfm.sff's own 9000,0", () => {
    // Confirmed (by hand) that today's extract-sff-sprite.js throws
    // "unsupported format 4" on exactly this sprite - real-world coverage
    // this plugin adds beyond that script.
    const buf = loadSff("chars/kfm/kfm.sff");
    const png = decodeSpriteToPng(buf, 9000, 0);
    const decoded = decodePng(png);
    expect(decoded.pixels.some((b) => b !== decoded.pixels[0])).toBe(true);
  });

  it("decodes a format 2 (RLE8) sprite - kfm.sff's own 9000,1", () => {
    // Confirmed (by hand) that today's extract-sff-sprite.js throws
    // "unsupported format 2" on exactly this sprite.
    const buf = loadSff("chars/kfm/kfm.sff");
    const png = decodeSpriteToPng(buf, 9000, 1);
    const decoded = decodePng(png);
    expect(decoded.pixels.some((b) => b !== decoded.pixels[0])).toBe(true);
  });

  it("throws for a sprite that doesn't exist", () => {
    const buf = loadSff("chars/kfm/kfm.sff");
    expect(() => decodeSpriteToPng(buf, 1, 99999)).toThrow(/not found/);
  });
});
