// Ties together header parsing, the two compressed-sprite decoders, and the
// embedded-PNG path into one "give me this sprite's pixels" entry point -
// mirrors examples/mugen/utils/extract-sff-sprite.js's extract(), extended
// with format 2 (RLE8) and format 4 (LZ5) support (see rle8.ts/lz5.ts).

import { readHeader, findSprite, readPalette } from "./header";
import { decodePng, indexedToRgba, encodeRgbaPng, DecodedPng } from "./png";
import { rle8Decode } from "./rle8";
import { lz5Decode } from "./lz5";

export type DecodedSprite = {
  width: number,
  height: number,
  // Copied straight off the sprite header - only meaningful when composing
  // several sprites into one image (see air.ts/animation.ts).
  axisX: number,
  axisY: number,
  rgba: Buffer,
};

// Every embedded-PNG color type this plugin can meet, flattened to the one
// shape the rest of the code works in. Indexed (colorType 3) never reaches
// here - decodeSprite substitutes the SFF-level palette itself.
function truecolorToRgba(decoded: DecodedPng): Buffer {
  if (decoded.colorType === 6) return decoded.pixels;
  if (decoded.colorType === 2) {
    const pixelCount = decoded.width * decoded.height;
    const rgba = Buffer.alloc(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
      rgba[i * 4] = decoded.pixels[i * 3];
      rgba[i * 4 + 1] = decoded.pixels[i * 3 + 1];
      rgba[i * 4 + 2] = decoded.pixels[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }
  throw new Error(`embedded PNG color type ${decoded.colorType} not supported`);
}

export function decodeSprite(buf: Buffer, group: number, number: number): DecodedSprite {
  const header = readHeader(buf);
  const sprite = findSprite(buf, header, group, number);
  const abs = (sprite.flag & 1 ? header.tofs : header.lofs) + sprite.dataOfs;
  const geometry = { width: sprite.w, height: sprite.h, axisX: sprite.axisX, axisY: sprite.axisY };

  if (sprite.format === 0) {
    if (sprite.dataSize !== sprite.w * sprite.h) {
      throw new Error(`sprite ${group},${number} has unexpected raw data size`);
    }
    const palette = readPalette(buf, header, sprite.palidx);
    return { ...geometry, rgba: indexedToRgba(buf.subarray(abs, abs + sprite.dataSize), palette) };
  }

  if (sprite.format === 2 || sprite.format === 4) {
    // Both compressed formats carry the same 4-byte prefix before their
    // payload as the embedded-PNG formats below (confirmed against
    // Ikemen-GO's own readV2 - src/image.go - which seeks to offset+4 for
    // every format in this branch, formats 2/3/4/10/11/12 alike).
    const payload = buf.subarray(abs + 4, abs + sprite.dataSize);
    const outputLength = sprite.w * sprite.h;
    const indexed = sprite.format === 2
      ? rle8Decode(payload, outputLength)
      : lz5Decode(payload, outputLength);
    const palette = readPalette(buf, header, sprite.palidx);
    return { ...geometry, rgba: indexedToRgba(indexed, palette) };
  }

  if (sprite.format === 10 || sprite.format === 11 || sprite.format === 12) {
    const decoded = decodePng(buf.subarray(abs + 4, abs + sprite.dataSize));
    if (decoded.width !== sprite.w || decoded.height !== sprite.h) {
      throw new Error(`sprite ${group},${number} PNG size doesn't match sprite header`);
    }
    if (decoded.colorType === 3) {
      // Indexed PNG - its own PLTE is a degenerate placeholder, substitute
      // the SFF-level palette instead (see extract-sff-sprite.js's format=10
      // gotcha note).
      const palette = readPalette(buf, header, sprite.palidx);
      return { ...geometry, rgba: indexedToRgba(decoded.pixels, palette) };
    }
    return { ...geometry, rgba: truecolorToRgba(decoded) };
  }

  throw new Error(
    `sprite ${group},${number} uses unsupported format ${sprite.format} (only 0/2/4/10/11/12 are supported)`
  );
}

export function decodeSpriteToPng(buf: Buffer, group: number, number: number): Buffer {
  const sprite = decodeSprite(buf, group, number);
  return encodeRgbaPng(sprite.width, sprite.height, sprite.rgba);
}
