#!/usr/bin/env node
// Extracts a single sprite from a MUGEN/Ikemen SFF v2 file as a standalone PNG -
// used to pull character/stage portrait sprites out for use as roster-lock
// humanInfo.image thumbnails (see roster-locks/build-draft.sh).
//
// Usage:
//   node extract-sff-sprite.js <in.sff> <group>,<number> <out.png>
//
// Format notes (reverse-engineered against Ikemen-GO's own src/image.go, same
// header/sprite-header layout already documented in append-sff-sprites.js):
//   - SFF v2 header fields used here (all uint32 LE): FirstSpriteHeaderOffset
//     @36, NumberOfSprites @40, FirstPaletteHeaderOffset @44, NumberOfPalettes
//     @48, lofs @52, tofs @60.
//   - Gotcha: a sprite header's `ofs` is relative to lofs when flag bit0=0,
//     but relative to tofs when flag bit0=1 - append-sff-sprites.js always
//     writes flag=0/lofs-relative for its own new sprites, but the group-500
//     overlay sprites actually committed in stage0_storm.sff/
//     stage0_rainbow.sff (built before this bit was understood) came out
//     flag=1/tofs-relative, so both must be handled.
//   - Palette headers are 16 bytes: Group,Number,NumColors,Linked (u16 each),
//     ofs (u32, relative to lofs), size (u32). Palette data is NumColors*4
//     raw RGBA bytes (verified against kfm.sff: index 0 is [255,255,255,0],
//     i.e. MUGEN's usual transparent-index-0 convention, alpha already 0).
//   - format=0: raw indexed pixels, 1 byte/pixel, row-major, no padding
//     (dataSize == width*height for every sprite checked).
//   - format=10/11/12: literal PNG bytes with a 4-byte prefix Ikemen skips
//     (verified non-zero for format 10 - looks like a decoded-size hint, not
//     always the zero padding format 12 uses - but irrelevant for extraction,
//     the PNG signature always starts right after those 4 bytes).
//   - Gotcha: format=10's embedded PNG is colortype 3 (indexed), but its own
//     PLTE chunk is a degenerate all-black placeholder (verified against
//     kfm_zaxis.sff's 9000,1) - Ikemen must substitute the sprite's SFF-level
//     palette (looked up via palidx, same table format=0 uses) rather than
//     trust the container PNG's PLTE. This tool does the same: for any
//     embedded PNG that turns out to be colortype 3, it decodes the raw
//     index bytes itself and re-maps them through the SFF palette instead of
//     handing the PNG bytes off untouched. Truecolor embedded PNGs (colortype
//     2/6, seen for format=11/12) are written out as-is since they carry
//     real color data.
//   - format=2 (RLE8)/format=4 (LZ5) are NOT supported by this tool - no
//     reference decoding to validate against in this environment. Source an
//     equivalent sprite from a sibling piece that stores it as format 0/10/12
//     instead (e.g. kfm.sff's own 9000,1 portrait is RLE8, but the pixel-
//     identical copies bundled with kfm_zaxis/kfm_zss store it as PNG8).
//
// PNG decode/encode itself lives in ./png.js, shared with compose-stage-preview.js.

const fs = require("fs");
const { decodePng, indexedToRgba, encodeRgbaPng } = require("./png");

function readHeader(buf) {
  return {
    firstSpriteOfs: buf.readUInt32LE(36),
    numSprites: buf.readUInt32LE(40),
    firstPalOfs: buf.readUInt32LE(44),
    lofs: buf.readUInt32LE(52),
    tofs: buf.readUInt32LE(60),
  };
}

function findSprite(buf, header, group, number) {
  let ofs = header.firstSpriteOfs;
  for (let i = 0; i < header.numSprites; i++, ofs += 28) {
    if (buf.readUInt16LE(ofs) === group && buf.readUInt16LE(ofs + 2) === number) {
      return {
        w: buf.readUInt16LE(ofs + 4),
        h: buf.readUInt16LE(ofs + 6),
        format: buf.readUInt8(ofs + 14),
        dataOfs: buf.readUInt32LE(ofs + 16),
        dataSize: buf.readUInt32LE(ofs + 20),
        palidx: buf.readUInt16LE(ofs + 24),
        flag: buf.readUInt16LE(ofs + 26),
      };
    }
  }
  throw new Error(`sprite ${group},${number} not found`);
}

function readPalette(buf, header, palidx) {
  const po = header.firstPalOfs + palidx * 16;
  const numColors = buf.readUInt16LE(po + 4);
  const ofs = buf.readUInt32LE(po + 8);
  const abs = header.lofs + ofs;
  const colors = [];
  for (let i = 0; i < numColors; i++) {
    const o = abs + i * 4;
    colors.push([buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]);
  }
  return colors;
}

function extract(inPath, group, number, outPath) {
  const buf = fs.readFileSync(inPath);
  if (buf.toString("ascii", 0, 12) !== "ElecbyteSpr\x00") {
    throw new Error(`${inPath}: not an SFF file (bad signature)`);
  }
  const header = readHeader(buf);
  const sprite = findSprite(buf, header, group, number);
  const abs = (sprite.flag & 1 ? header.tofs : header.lofs) + sprite.dataOfs;

  if (sprite.format === 0) {
    if (sprite.dataSize !== sprite.w * sprite.h) {
      throw new Error(`${inPath}: sprite ${group},${number} has unexpected raw data size`);
    }
    const palette = readPalette(buf, header, sprite.palidx);
    const rgba = indexedToRgba(buf.subarray(abs, abs + sprite.dataSize), palette);
    fs.writeFileSync(outPath, encodeRgbaPng(sprite.w, sprite.h, rgba));
  } else if (sprite.format === 10 || sprite.format === 11 || sprite.format === 12) {
    const pngBytes = buf.subarray(abs + 4, abs + sprite.dataSize);
    const decoded = decodePng(pngBytes);
    if (decoded.width !== sprite.w || decoded.height !== sprite.h) {
      throw new Error(`${inPath}: sprite ${group},${number} PNG size doesn't match sprite header`);
    }
    if (decoded.colorType === 3) {
      // Indexed PNG - its own PLTE is a degenerate placeholder, substitute the
      // SFF-level palette instead (see the format=10 gotcha note up top).
      const palette = readPalette(buf, header, sprite.palidx);
      const rgba = indexedToRgba(decoded.pixels, palette);
      fs.writeFileSync(outPath, encodeRgbaPng(sprite.w, sprite.h, rgba));
    } else {
      // Truecolor PNG - real pixel data, write through untouched.
      fs.writeFileSync(outPath, pngBytes);
    }
  } else {
    throw new Error(
      `${inPath}: sprite ${group},${number} uses unsupported format ${sprite.format} ` +
      `(only 0/10/11/12 are supported)`
    );
  }
  console.log(`Wrote ${outPath} (${sprite.w}x${sprite.h}, format ${sprite.format})`);
}

function main() {
  const [inPath, spriteKey, outPath] = process.argv.slice(2);
  if (!inPath || !spriteKey || !outPath) {
    console.log("Usage: node extract-sff-sprite.js <in.sff> <group>,<number> <out.png>");
    process.exit(1);
  }
  const [group, number] = spriteKey.split(",").map(Number);
  extract(inPath, group, number, outPath);
}

main();
