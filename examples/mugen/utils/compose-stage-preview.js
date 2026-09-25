#!/usr/bin/env node
// Builds a distinct roster-lock preview image for a stage0 variant by
// compositing its overlay art (rain/flash for storm, arc/sparkle for
// rainbow) onto the base Training Room preview sprite - used because all
// three stage0 variants share the exact same SFF-embedded 9000,1 preview
// sprite (they only add new sprites in group 500, see roster-locks/readme.md),
// so extracting that sprite directly gives identical, non-representative
// previews for all three.
//
// Usage:
//   node compose-stage-preview.js rainbow --base <preview.png> --arc <arc.png> \
//     --sparkle <sparkle.png> --out <out.png>
//   node compose-stage-preview.js storm --base <preview.png> --rain <rain.png> \
//     --flash <flash.png> --out <out.png>
//
// This only needs to produce a recognizable thumbnail, not a frame-accurate
// re-render of the stage.def's actual [BG] animation - nearest-neighbor
// scaling and fixed placements are good enough here.

const fs = require("fs");
const { decodePngToRgba, encodeRgbaPng } = require("./png");

function loadPng(path) {
  return decodePngToRgba(fs.readFileSync(path));
}

function makeCanvas(width, height, [r, g, b, a]) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = a;
  }
  return { width, height, pixels };
}

function resizeNearest(src, width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / width));
      const s = (sy * src.width + sx) * 4;
      const d = (y * width + x) * 4;
      src.pixels.copy(pixels, d, s, s + 4);
    }
  }
  return { width, height, pixels };
}

// Alpha-over blends src onto dst at offset (dx,dy), clipped to dst's bounds.
// dst is always treated as fully opaque (every canvas here starts opaque),
// so the output stays opaque too - no need to track a running alpha.
function paste(dst, src, dx, dy, opacity = 1) {
  for (let sy = 0; sy < src.height; sy++) {
    const y = dy + sy;
    if (y < 0 || y >= dst.height) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const x = dx + sx;
      if (x < 0 || x >= dst.width) continue;
      const s = (sy * src.width + sx) * 4;
      const srcA = (src.pixels[s + 3] / 255) * opacity;
      if (srcA <= 0) continue;
      const d = (y * dst.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        dst.pixels[d + c] = Math.round(src.pixels[s + c] * srcA + dst.pixels[d + c] * (1 - srcA));
      }
    }
  }
}

function tile(dst, src, opacity = 1) {
  for (let dy = 0; dy < dst.height; dy += src.height) {
    for (let dx = 0; dx < dst.width; dx += src.width) {
      paste(dst, src, dx, dy, opacity);
    }
  }
}

// Multiplies every pixel's RGB by a factor - used to darken/tint the base
// preview for the storm variant's mood.
function tintMultiply(canvas, [rf, gf, bf]) {
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    const p = i * 4;
    canvas.pixels[p] = Math.round(canvas.pixels[p] * rf);
    canvas.pixels[p + 1] = Math.round(canvas.pixels[p + 1] * gf);
    canvas.pixels[p + 2] = Math.round(canvas.pixels[p + 2] * bf);
  }
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) flags[argv[i].replace(/^--/, "")] = argv[i + 1];
  return flags;
}

function composeRainbow(flags) {
  const base = loadPng(flags.base);
  const canvas = { width: base.width, height: base.height, pixels: Buffer.from(base.pixels) };

  // Arc is 320x150 in-game; scale to canvas width and top-align so the
  // colorful apex stays fully visible even if the transparent-hole bottom
  // edge gets clipped by the shorter thumbnail canvas.
  const arc = loadPng(flags.arc);
  const arcScaled = resizeNearest(arc, canvas.width, Math.round((arc.height * canvas.width) / arc.width));
  paste(canvas, arcScaled, 0, 0);

  // A handful of small sparkle instances scattered across the canvas.
  const sparkle = loadPng(flags.sparkle);
  const sparkleScaled = resizeNearest(sparkle, 22, 22);
  const positions = [
    [10, 8], [70, 55], [140, 15], [190, 60], [40, 70], [210, 30],
  ];
  for (const [x, y] of positions) paste(canvas, sparkleScaled, x, y);

  fs.writeFileSync(flags.out, encodeRgbaPng(canvas.width, canvas.height, canvas.pixels));
  console.log(`Wrote ${flags.out} (rainbow, ${canvas.width}x${canvas.height})`);
}

function composeStorm(flags) {
  const base = loadPng(flags.base);
  const canvas = { width: base.width, height: base.height, pixels: Buffer.from(base.pixels) };

  // Darken and cool the base floor towards a stormy blue-grey.
  tintMultiply(canvas, [0.55, 0.6, 0.75]);

  // Tile the rain-streak texture across the whole canvas at reduced opacity,
  // scaled so a couple of tile repeats fit the thumbnail's height.
  const rain = loadPng(flags.rain);
  const rainScaled = resizeNearest(rain, Math.round((rain.width * canvas.height) / rain.height / 1.6), canvas.height);
  tile(canvas, rainScaled, 0.5);

  // The lightning flash is a uniform near-white fill in-game (drawn with
  // `trans = add`); approximate that by blending it across the whole canvas
  // at low opacity rather than reproducing the additive blend mode exactly.
  const flash = loadPng(flags.flash);
  const flashScaled = resizeNearest(flash, canvas.width, canvas.height);
  paste(canvas, flashScaled, 0, 0, 0.12);

  fs.writeFileSync(flags.out, encodeRgbaPng(canvas.width, canvas.height, canvas.pixels));
  console.log(`Wrote ${flags.out} (storm, ${canvas.width}x${canvas.height})`);
}

function main() {
  const [recipe, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (recipe === "rainbow") composeRainbow(flags);
  else if (recipe === "storm") composeStorm(flags);
  else {
    console.log("Usage: node compose-stage-preview.js <rainbow|storm> --base <f> ... --out <f>");
    process.exit(1);
  }
}

main();
