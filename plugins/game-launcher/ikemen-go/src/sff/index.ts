// Ties together header parsing, the two compressed-sprite decoders, and the
// embedded-PNG path into one "give me this sprite as a PNG" entry point -
// mirrors examples/mugen/utils/extract-sff-sprite.js's extract(), extended
// with format 2 (RLE8) and format 4 (LZ5) support (see rle8.ts/lz5.ts).

import { readHeader, findSprite, readPalette } from "./header";
import { decodePng, indexedToRgba, encodeRgbaPng } from "./png";
import { rle8Decode } from "./rle8";
import { lz5Decode } from "./lz5";

export function decodeSpriteToPng(buf: Buffer, group: number, number: number): Buffer {
  const header = readHeader(buf);
  const sprite = findSprite(buf, header, group, number);
  const abs = (sprite.flag & 1 ? header.tofs : header.lofs) + sprite.dataOfs;

  if (sprite.format === 0) {
    if (sprite.dataSize !== sprite.w * sprite.h) {
      throw new Error(`sprite ${group},${number} has unexpected raw data size`);
    }
    const palette = readPalette(buf, header, sprite.palidx);
    const rgba = indexedToRgba(buf.subarray(abs, abs + sprite.dataSize), palette);
    return encodeRgbaPng(sprite.w, sprite.h, rgba);
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
    const rgba = indexedToRgba(indexed, palette);
    return encodeRgbaPng(sprite.w, sprite.h, rgba);
  }

  if (sprite.format === 10 || sprite.format === 11 || sprite.format === 12) {
    const pngBytes = buf.subarray(abs + 4, abs + sprite.dataSize);
    const decoded = decodePng(pngBytes);
    if (decoded.width !== sprite.w || decoded.height !== sprite.h) {
      throw new Error(`sprite ${group},${number} PNG size doesn't match sprite header`);
    }
    if (decoded.colorType === 3) {
      // Indexed PNG - its own PLTE is a degenerate placeholder, substitute
      // the SFF-level palette instead (see extract-sff-sprite.js's format=10
      // gotcha note).
      const palette = readPalette(buf, header, sprite.palidx);
      const rgba = indexedToRgba(decoded.pixels, palette);
      return encodeRgbaPng(sprite.w, sprite.h, rgba);
    }
    // Truecolor PNG - real pixel data, return as-is.
    return Buffer.from(pngBytes);
  }

  throw new Error(
    `sprite ${group},${number} uses unsupported format ${sprite.format} (only 0/2/4/10/11/12 are supported)`
  );
}
