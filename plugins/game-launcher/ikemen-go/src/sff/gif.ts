// Minimal GIF89a encoder - animated, one shared global color table, one
// transparent index.
//
// GIF specifically (rather than APNG or a frame list in PiecePreview) because
// it costs nothing anywhere else: PiecePreview stays { kind: "image",
// dataUri }, and every browser animates a GIF inside a plain <img>, so the
// selection screen needs no change at all to play one. It also suits the
// input - MUGEN sprites are already palette-indexed, so quantizing back down
// to a color table is usually lossless.

export type GifFrame = {
  // One byte per pixel, width*height of them, indexing into the palette.
  indexes: Buffer,
  delayCentiseconds: number,
};

export type GifPalette = {
  colors: Array<[number, number, number]>,
  transparentIndex: number,
};

// Browsers treat a delay of 0 or 1 as "unspecified" and substitute ~10cs,
// which would stretch a fast frame instead of shortening it.
const MIN_DELAY_CENTISECONDS = 2;
const MAX_COLORS = 256;

function colorTableSizeExponent(entryCount: number): number {
  // GIF color tables are 2^(n+1) entries, n in 0..7.
  let exponent = 0;
  while ((1 << (exponent + 1)) < entryCount) exponent += 1;
  return Math.min(exponent, 7);
}

// GIF's LZW variant: LSB-first bit packing, code width growing from
// minCodeSize+1 as the dictionary fills, and an explicit clear when it hits
// 4096 entries.
function lzwCompress(indexes: Buffer, minCodeSize: number): Buffer {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const out: Array<number> = [];
  let codeWidth = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = new Map<number, number>();
  let bitBuffer = 0;
  let bitCount = 0;

  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeWidth;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);
  let prefix = -1;
  for (const byte of indexes) {
    if (prefix === -1) {
      prefix = byte;
      continue;
    }
    const key = (prefix << 8) | byte;
    const existing = dictionary.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    emit(prefix);
    if (nextCode === 4096) {
      // Dictionary full - reset both sides to the initial state.
      emit(clearCode);
      dictionary = new Map();
      nextCode = endCode + 1;
      codeWidth = minCodeSize + 1;
    } else {
      // Widen *before* assigning, so the decoder (always one entry behind)
      // reads this code at the same width it was written.
      if (nextCode >= (1 << codeWidth)) codeWidth += 1;
      dictionary.set(key, nextCode);
      nextCode += 1;
    }
    prefix = byte;
  }
  if (prefix !== -1) emit(prefix);
  emit(endCode);
  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return Buffer.from(out);
}

// Image data travels as sub-blocks of at most 255 bytes, terminated by an
// empty one.
function subBlocks(data: Buffer): Buffer {
  const parts: Array<Buffer> = [];
  for (let offset = 0; offset < data.length; offset += 255) {
    const chunk = data.subarray(offset, offset + 255);
    parts.push(Buffer.from([chunk.length]), chunk);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

export function encodeGif(
  width: number, height: number, palette: GifPalette, frames: Array<GifFrame>
): Buffer {
  if (frames.length === 0) throw new Error("cannot encode a GIF with no frames");
  const entryCount = Math.max(palette.colors.length, palette.transparentIndex + 1, 2);
  if (entryCount > MAX_COLORS) throw new Error(`palette has ${entryCount} entries (max ${MAX_COLORS})`);
  const exponent = colorTableSizeExponent(entryCount);
  const tableEntries = 1 << (exponent + 1);

  const colorTable = Buffer.alloc(tableEntries * 3);
  palette.colors.forEach(([r, g, b], index) => {
    colorTable[index * 3] = r;
    colorTable[index * 3 + 1] = g;
    colorTable[index * 3 + 2] = b;
  });

  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  // Global color table present | 8-bit color resolution | table size.
  screen[4] = 0x80 | 0x70 | exponent;
  screen[5] = palette.transparentIndex;
  screen[6] = 0;

  // NETSCAPE2.0 application extension with a loop count of 0 - the only way
  // to say "repeat forever".
  const loopForever = Buffer.concat([
    Buffer.from([0x21, 0xff, 0x0b]), Buffer.from("NETSCAPE2.0", "ascii"),
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
  ]);

  const minCodeSize = Math.max(2, exponent + 1);
  const parts: Array<Buffer> = [Buffer.from("GIF89a", "ascii"), screen, colorTable, loopForever];

  for (const frame of frames) {
    if (frame.indexes.length !== width * height) {
      throw new Error(`frame has ${frame.indexes.length} pixels, expected ${width * height}`);
    }
    const control = Buffer.alloc(8);
    control[0] = 0x21;
    control[1] = 0xf9;
    control[2] = 0x04;
    // Disposal method 2 (restore to background) | transparent color flag.
    // Every frame here is a full-canvas composite, so each must start from a
    // clean canvas rather than showing through the one before it.
    control[3] = (2 << 2) | 0x01;
    control.writeUInt16LE(Math.max(frame.delayCentiseconds, MIN_DELAY_CENTISECONDS), 4);
    control[6] = palette.transparentIndex;
    control[7] = 0;

    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(0, 1); // left
    descriptor.writeUInt16LE(0, 3); // top
    descriptor.writeUInt16LE(width, 5);
    descriptor.writeUInt16LE(height, 7);
    descriptor[9] = 0; // no local color table, not interlaced

    parts.push(control, descriptor, Buffer.from([minCodeSize]), subBlocks(lzwCompress(frame.indexes, minCodeSize)));
  }

  parts.push(Buffer.from([0x3b])); // trailer
  return Buffer.concat(parts);
}

// Maps a set of same-sized RGBA frames onto one shared color table.
//
// MUGEN sprites come out of a palette to begin with, so the distinct-color
// count is normally well under the limit and this is exact. When it isn't,
// the most-used colors win the table and the rest snap to their nearest
// neighbour - a visible-but-graceful loss, rather than refusing the preview.
export function quantizeToSharedPalette(
  rgbaFrames: Array<Buffer>, alphaThreshold = 128
): { palette: GifPalette, frames: Array<Buffer> } {
  const counts = new Map<number, number>();
  for (const rgba of rgbaFrames) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < alphaThreshold) continue;
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // One slot is reserved for transparency, so only MAX_COLORS-1 real colors fit.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_COLORS - 1);
  const colors: Array<[number, number, number]> = ranked.map(([key]) => [key >> 16, (key >> 8) & 0xff, key & 0xff]);
  const transparentIndex = colors.length;
  const exactIndex = new Map(ranked.map(([key], index) => [key, index]));

  // Colors that didn't make the table resolve once and stay resolved - a
  // nearest-neighbour scan over the whole table per *pixel* would be far too
  // slow on a full-size sprite.
  const nearestCache = new Map<number, number>();
  const nearestIndex = (key: number): number => {
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;
    const [r, g, b] = [key >> 16, (key >> 8) & 0xff, key & 0xff];
    let best = 0;
    let bestDistance = Infinity;
    colors.forEach(([cr, cg, cb], index) => {
      const distance = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    nearestCache.set(key, best);
    return best;
  };

  const frames = rgbaFrames.map((rgba) => {
    const indexes = Buffer.alloc(rgba.length / 4);
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      if (rgba[i + 3] < alphaThreshold) {
        indexes[p] = transparentIndex;
        continue;
      }
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      indexes[p] = exactIndex.get(key) ?? nearestIndex(key);
    }
    return indexes;
  });

  return { palette: { colors, transparentIndex }, frames };
}
