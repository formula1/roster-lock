import { describe, it, expect } from "vitest";
import { encodeGif, quantizeToSharedPalette, GifPalette } from "../src/sff/gif";

// An independent GIF reader, written against the spec rather than against
// gif.ts, so the encoder is checked by decoding its output rather than by
// asserting on bytes it happened to produce. LZW is the part worth this: an
// off-by-one in the code-width growth produces a file that still *looks*
// structurally fine.
function decodeGif(gif: Buffer) {
  expect(gif.subarray(0, 6).toString("ascii")).toBe("GIF89a");
  expect(gif[gif.length - 1]).toBe(0x3b);

  const width = gif.readUInt16LE(6);
  const height = gif.readUInt16LE(8);
  const packed = gif[10];
  const tableEntries = 1 << ((packed & 0x07) + 1);
  let pos = 13 + tableEntries * 3;

  const frames: Array<{ indexes: Array<number>, delay: number, transparentIndex: number }> = [];
  let pending: { delay: number, transparentIndex: number } | undefined;

  const readSubBlocks = (): Buffer => {
    const parts: Array<Buffer> = [];
    while (gif[pos] !== 0) {
      const length = gif[pos];
      parts.push(gif.subarray(pos + 1, pos + 1 + length));
      pos += 1 + length;
    }
    pos += 1;
    return Buffer.concat(parts);
  };

  while (pos < gif.length && gif[pos] !== 0x3b) {
    if (gif[pos] === 0x21 && gif[pos + 1] === 0xf9) {
      pending = { delay: gif.readUInt16LE(pos + 4), transparentIndex: gif[pos + 6] };
      pos += 3 + gif[pos + 2] + 1;
    } else if (gif[pos] === 0x21) {
      pos += 2;
      readSubBlocks();
    } else if (gif[pos] === 0x2c) {
      const frameWidth = gif.readUInt16LE(pos + 5);
      const frameHeight = gif.readUInt16LE(pos + 7);
      pos += 10;
      const minCodeSize = gif[pos];
      pos += 1;
      const data = readSubBlocks();

      // Straight LZW decode: read minCodeSize+1 bit codes LSB-first, growing
      // the width as the table fills, resetting on a clear code.
      const clearCode = 1 << minCodeSize;
      const endCode = clearCode + 1;
      let codeWidth = minCodeSize + 1;
      let table: Array<Array<number>> = [];
      const resetTable = () => {
        table = [];
        for (let i = 0; i < clearCode; i++) table.push([i]);
        table.push([], []);
        codeWidth = minCodeSize + 1;
      };
      resetTable();

      const indexes: Array<number> = [];
      let bitPos = 0;
      let previous: Array<number> | undefined;
      const readCode = (): number => {
        let code = 0;
        for (let i = 0; i < codeWidth; i++) {
          const byte = data[(bitPos >> 3)] ?? 0;
          code |= ((byte >> (bitPos & 7)) & 1) << i;
          bitPos += 1;
        }
        return code;
      };

      for (;;) {
        const code = readCode();
        if (code === clearCode) { resetTable(); previous = undefined; continue; }
        if (code === endCode) break;
        let entry: Array<number>;
        if (code < table.length) entry = table[code];
        else if (previous) entry = [...previous, previous[0]];
        else throw new Error(`bad LZW code ${code}`);
        indexes.push(...entry);
        if (previous) {
          table.push([...previous, entry[0]]);
          if (table.length === (1 << codeWidth) && codeWidth < 12) codeWidth += 1;
        }
        previous = entry;
      }

      expect(indexes).toHaveLength(frameWidth * frameHeight);
      frames.push({ indexes, delay: pending!.delay, transparentIndex: pending!.transparentIndex });
    } else {
      throw new Error(`unexpected block 0x${gif[pos].toString(16)} at ${pos}`);
    }
  }
  return { width, height, tableEntries, frames };
}

const palette: GifPalette = { colors: [[255, 0, 0], [0, 255, 0], [0, 0, 255]], transparentIndex: 3 };

describe("encodeGif", () => {
  it("round-trips every frame's pixels, size and delay", () => {
    const frames = [
      { indexes: Buffer.from([0, 1, 2, 3]), delayCentiseconds: 17 },
      { indexes: Buffer.from([3, 2, 1, 0]), delayCentiseconds: 42 },
    ];
    const decoded = decodeGif(encodeGif(2, 2, palette, frames));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.frames.map((f) => f.indexes)).toEqual([[0, 1, 2, 3], [3, 2, 1, 0]]);
    expect(decoded.frames.map((f) => f.delay)).toEqual([17, 42]);
    expect(decoded.frames.every((f) => f.transparentIndex === 3)).toBe(true);
  });

  it("round-trips an image big enough to grow the LZW code width past its start", () => {
    // 64x64 of pseudo-random indexes fills the dictionary well past 512
    // entries, so this only passes if the width grows in step with a decoder.
    const big = Buffer.alloc(64 * 64);
    let seed = 12345;
    for (let i = 0; i < big.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      big[i] = seed % 3;
    }
    const decoded = decodeGif(encodeGif(64, 64, palette, [{ indexes: big, delayCentiseconds: 10 }]));
    expect(Buffer.from(decoded.frames[0].indexes).equals(big)).toBe(true);
  });

  it("raises a delay browsers would silently replace", () => {
    // 0 and 1 centiseconds are treated as "unspecified" and become ~10.
    const decoded = decodeGif(encodeGif(1, 1, palette, [{ indexes: Buffer.from([0]), delayCentiseconds: 0 }]));
    expect(decoded.frames[0].delay).toBe(2);
  });

  it("rejects a frame whose pixel count doesn't match the canvas", () => {
    expect(() => encodeGif(2, 2, palette, [{ indexes: Buffer.from([0]), delayCentiseconds: 10 }]))
      .toThrow(/expected 4/);
  });

  it("rejects an empty animation", () => {
    expect(() => encodeGif(1, 1, palette, [])).toThrow(/no frames/);
  });
});

describe("quantizeToSharedPalette", () => {
  function rgba(pixels: Array<[number, number, number, number]>): Buffer {
    return Buffer.from(pixels.flat());
  }

  it("builds one exact palette across frames and maps transparency to its own index", () => {
    const frameA = rgba([[255, 0, 0, 255], [0, 0, 0, 0]]);
    const frameB = rgba([[0, 0, 255, 255], [255, 0, 0, 255]]);
    const { palette: built, frames } = quantizeToSharedPalette([frameA, frameB]);

    expect(built.colors).toHaveLength(2);
    expect(built.transparentIndex).toBe(2);
    // Red appears twice and so ranks first; the shared table is what both
    // frames index into.
    expect(built.colors[0]).toEqual([255, 0, 0]);
    expect([...frames[0]]).toEqual([0, 2]);
    expect([...frames[1]]).toEqual([built.colors.findIndex((c) => c[2] === 255), 0]);
  });

  it("keeps the most-used colors and snaps the rest to their nearest neighbour", () => {
    // 256 distinct colors, one slot reserved for transparency, so one color
    // has to be dropped - the least frequent one.
    const pixels: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 256; i++) {
      const repeats = i === 255 ? 1 : 2; // color 255 is the rarest
      for (let n = 0; n < repeats; n++) pixels.push([i, 0, 0, 255]);
    }
    const { palette: built, frames } = quantizeToSharedPalette([rgba(pixels)]);
    expect(built.colors).toHaveLength(255);
    expect(built.transparentIndex).toBe(255);
    expect(built.colors.some(([r]) => r === 255)).toBe(false);
    // The dropped color resolves to 254, its nearest surviving neighbour.
    const dropped = frames[0][frames[0].length - 1];
    expect(built.colors[dropped]).toEqual([254, 0, 0]);
  });
});
