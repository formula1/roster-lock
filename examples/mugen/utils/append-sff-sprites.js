#!/usr/bin/env node
// Appends new truecolor PNG sprites onto a copy of an existing MUGEN/Ikemen
// SFF v2 file, without touching any of its existing sprites or palette data.
//
// Usage:
//   node append-sff-sprites.js --in stage0.sff --out stage0_rainbow.sff \
//     --sprite 500,0=arc.png --sprite 500,1=sparkle.png
//
// Why this exists: Ikemen-GO stages/characters need their art packed into an
// SFF container - there's no way to just point a [BG]/sprite at a loose PNG
// file. This lets you build an original art overlay (e.g. a stage's rain,
// flash, rainbow, sparkle layer) as plain PNGs and splice them onto a copy of
// a base SFF as new sprites, so the base file's own sprites/palette table
// never need to be touched or re-encoded.
//
// Format notes (reverse-engineered against Ikemen-GO's own src/image.go -
// SffHeader.Read / Sprite.readHeaderV2 / Sprite.readV2 - not guessed):
//   - SFF v2 header fields used here (all uint32 LE): FirstSpriteHeaderOffset
//     @36, NumberOfSprites @40, FirstPaletteHeaderOffset @44,
//     NumberOfPalettes @48, lofs @52, tofs @60.
//   - Each sprite header is 28 bytes: Group,Number,W,H (u16), OffsetX,OffsetY
//     (i16), link (u16), format (u8), coldepth (u8), ofs (u32), size (u32),
//     palidx (u16), flag (u16).
//   - format=12 (PNG, always decoded to RGBA regardless of 11 vs 12 in
//     Ikemen's current source) with a 4-byte zero prefix Ikemen always skips
//     before the actual PNG bytes. coldepth is hardcoded to 32 by the loader
//     for this format either way, so it's written as 32 here too.
//   - New sprite headers are inserted right after the existing sprite-header
//     block; everything from that point in the original file (whatever sits
//     between the header block and Ldata, plus Ldata/Tdata themselves) is
//     preserved byte-for-byte and just shifts down by the inserted size.
//     lofs/tofs are bumped by that same amount. New pixel data is appended
//     at the true end of the file and referenced relative to the new lofs.
//
// Gotchas for whatever .def ends up pointing at the new sprites (learned the
// hard way building stage0_rainbow, not part of this tool but worth keeping
// next to it):
//   - `mask = 0` on a [BG] block maps to Ikemen's internal anim.mask = -1,
//     and the sprite shader force-opaques the sprite when mask == -1
//     (discards real PNG alpha). Truecolor sprites that need transparency
//     need `mask = 1`, not `mask = 0` (stage0's own opaque indexed
//     floor/wall sprites use 0, don't copy that value for these).
//   - For a non-tiled [BG], `start.x = 0` puts the sprite's *left edge* at
//     world x=0, which maps to screen-center, not the screen's left edge. A
//     full-width single sprite needs `start.x = -width/2` to be centered.

const fs = require("fs");
const path = require("path");

const SPRITE_HEADER_SIZE = 28;
const SIGNATURE = "ElecbyteSpr\x00";
const PNG_FORMAT = 12; // truecolor PNG; Ikemen always decodes this to RGBA
const PNG_COLDEPTH = 32;

function parseArgs(argv) {
  const args = { sprites: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--sprite") args.sprites.push(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unrecognized argument: ${a}`);
  }
  return args;
}

function usage() {
  console.log(
    [
      "Usage: node append-sff-sprites.js --in <source.sff> --out <dest.sff>",
      "         --sprite <group>,<number>=<path.png> [--sprite ...]",
      "",
      "Appends one or more truecolor PNGs onto a copy of an existing SFF v2",
      "file as new sprites, leaving all existing sprites/palette untouched.",
    ].join("\n")
  );
}

function readPngSize(pngPath) {
  const buf = fs.readFileSync(pngPath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) {
    throw new Error(`${pngPath} doesn't look like a PNG file (bad signature)`);
  }
  if (buf.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${pngPath}: expected IHDR as the first chunk`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  if (bitDepth !== 8) {
    throw new Error(
      `${pngPath}: expected 8-bit PNG, got ${bitDepth}-bit (re-export at 8 bits/channel)`
    );
  }
  return { width, height, bytes: buf };
}

function parseSpriteArg(arg) {
  const eq = arg.indexOf("=");
  if (eq < 0) {
    throw new Error(`--sprite value must be "<group>,<number>=<path.png>", got "${arg}"`);
  }
  const key = arg.slice(0, eq);
  const filePath = arg.slice(eq + 1);
  const [groupStr, numberStr] = key.split(",");
  const group = Number(groupStr);
  const number = Number(numberStr);
  if (!Number.isInteger(group) || !Number.isInteger(number)) {
    throw new Error(`--sprite key must be "<group>,<number>", got "${key}"`);
  }
  return { group, number, filePath };
}

function appendSprites(inPath, outPath, spriteSpecs) {
  const data = fs.readFileSync(inPath);

  if (data.toString("ascii", 0, 12) !== SIGNATURE) {
    throw new Error(`${inPath}: not an SFF file (bad signature)`);
  }
  if (data.readUInt8(15) !== 2) {
    throw new Error(`${inPath}: only SFF v2 is supported`);
  }

  const firstSpriteHdrOff = data.readUInt32LE(36);
  const numSprites = data.readUInt32LE(40);
  const lofs = data.readUInt32LE(52);
  const tofs = data.readUInt32LE(60);

  const insertionPoint = firstSpriteHdrOff + SPRITE_HEADER_SIZE * numSprites;
  if (insertionPoint > lofs || insertionPoint > tofs) {
    throw new Error(
      `${inPath}: unexpected SFF layout - sprite headers end at ${insertionPoint}, ` +
        `but lofs=${lofs} tofs=${tofs} (expected both >= end of sprite headers)`
    );
  }

  const headers = [];
  const blobs = [];
  let runningOfs = data.length - lofs; // relative to the new lofs, independent of insert size

  for (const { group, number, filePath } of spriteSpecs) {
    const { width, height, bytes } = readPngSize(filePath);
    const blob = Buffer.concat([Buffer.alloc(4), bytes]);

    const header = Buffer.alloc(SPRITE_HEADER_SIZE);
    header.writeUInt16LE(group, 0);
    header.writeUInt16LE(number, 2);
    header.writeUInt16LE(width, 4);
    header.writeUInt16LE(height, 6);
    header.writeInt16LE(0, 8); // offset x
    header.writeInt16LE(0, 10); // offset y
    header.writeUInt16LE(0, 12); // link (unused, size != 0 below)
    header.writeUInt8(PNG_FORMAT, 14);
    header.writeUInt8(PNG_COLDEPTH, 15);
    header.writeUInt32LE(runningOfs, 16);
    header.writeUInt32LE(blob.length, 20);
    header.writeUInt16LE(0, 24); // palidx (unused, truecolor)
    header.writeUInt16LE(0, 26); // flag bit0=0 -> ofs is relative to lofs

    headers.push(header);
    blobs.push(blob);
    runningOfs += blob.length;

    console.log(`  + sprite ${group},${number} <- ${path.basename(filePath)} (${width}x${height})`);
  }

  const insertedHeaders = Buffer.concat(headers);
  const out = Buffer.concat([
    data.subarray(0, insertionPoint),
    insertedHeaders,
    data.subarray(insertionPoint),
    ...blobs,
  ]);

  out.writeUInt32LE(numSprites + spriteSpecs.length, 40);
  out.writeUInt32LE(lofs + insertedHeaders.length, 52);
  out.writeUInt32LE(tofs + insertedHeaders.length, 60);

  fs.writeFileSync(outPath, out);
  console.log(`Wrote ${outPath} (${out.length} bytes, ${numSprites + spriteSpecs.length} sprites)`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.in || !args.out || args.sprites.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const spriteSpecs = args.sprites.map(parseSpriteArg);
  appendSprites(args.in, args.out, spriteSpecs);
}

main();
