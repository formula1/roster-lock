// Minimal PNG codec - ported from examples/mugen/utils/png.js. Decode covers
// 8-bit, non-interlaced PNGs only (all these MUGEN-derived assets ever use);
// encode always produces 8-bit RGBA, the one shape this plugin ever needs.

import zlib from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type DecodedPng = {
  width: number,
  height: number,
  colorType: number,
  pixels: Buffer,
};

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Decodes a PNG's IDAT into unfiltered scanlines, in whatever the file's own
// colorType is (2=RGB, 3=indexed, 6=RGBA - the ones seen in these assets).
// colorType 3 (indexed) pixels sometimes need a palette substitution the
// caller controls (see sff/index.ts's format=10 handling) rather than
// trusting the embedded PLTE, so this returns raw index bytes rather than
// resolving them itself.
export function decodePng(buf: Buffer): DecodedPng {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("not a PNG (bad signature)");
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth} (expected 8)`);
  if (interlace !== 0) throw new Error("interlaced PNG not supported");

  const channelsByColorType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const bpp = channelsByColorType[colorType];
  if (!bpp) throw new Error(`unsupported PNG color type ${colorType}`);

  const idatParts: Array<Buffer> = [];
  let pos = 8;
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IDAT") idatParts.push(buf.subarray(pos + 8, pos + 8 + length));
    pos += 8 + length + 4;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filterType = inflated[src++];
    const rowStart = y * stride;
    const priorRowStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const raw = inflated[src++];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = priorRowStart >= 0 ? out[priorRowStart + x] : 0;
      const c = x >= bpp && priorRowStart >= 0 ? out[priorRowStart + x - bpp] : 0;
      let value: number;
      if (filterType === 0) value = raw;
      else if (filterType === 1) value = raw + a;
      else if (filterType === 2) value = raw + b;
      else if (filterType === 3) value = raw + Math.floor((a + b) / 2);
      else if (filterType === 4) value = raw + paeth(a, b, c);
      else throw new Error(`unsupported PNG filter type ${filterType}`);
      out[rowStart + x] = value & 0xff;
    }
  }
  return { width, height, colorType, pixels: out };
}

export function indexedToRgba(indexBytes: Buffer, palette: Array<[number, number, number, number]>): Buffer {
  const rgba = Buffer.alloc(indexBytes.length * 4);
  for (let i = 0; i < indexBytes.length; i++) {
    const color = palette[indexBytes[i]];
    if (!color) throw new Error(`palette index ${indexBytes[i]} out of range (palette has ${palette.length} colors)`);
    const [r, g, b, a] = color;
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  return rgba;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function encodeRgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
