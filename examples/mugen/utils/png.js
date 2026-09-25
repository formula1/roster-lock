// Minimal PNG codec shared by this folder's SFF tooling - decode (8-bit,
// non-interlaced only, which is all these MUGEN-derived assets ever use) and
// encode (always as 8-bit RGBA, the one shape every caller here needs).

const zlib = require("zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
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
// Callers that need normalized RGBA should go through decodePngToRgba below;
// this raw form exists because indexed (colorType 3) pixels sometimes need a
// palette substitution the caller controls (see extract-sff-sprite.js).
function decodePng(buf) {
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

  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const bpp = channelsByColorType[colorType];
  if (!bpp) throw new Error(`unsupported PNG color type ${colorType}`);

  const idatParts = [];
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
      let value;
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

function indexedToRgba(indexBytes, palette) {
  const rgba = Buffer.alloc(indexBytes.length * 4);
  for (let i = 0; i < indexBytes.length; i++) {
    const [r, g, b, a] = palette[indexBytes[i]];
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  return rgba;
}

// Normalizes a decoded PNG to RGBA. colorType 3 (indexed) has no reliable
// built-in palette in the assets this folder deals with (see
// extract-sff-sprite.js's format=10 gotcha) so it's rejected here rather than
// silently trusting embedded PLTE - callers with an indexed source must
// resolve the real palette themselves and call indexedToRgba directly.
function decodePngToRgba(buf) {
  const decoded = decodePng(buf);
  if (decoded.colorType === 6) return decoded;
  if (decoded.colorType === 2) {
    const rgba = Buffer.alloc(decoded.width * decoded.height * 4);
    for (let i = 0; i < decoded.width * decoded.height; i++) {
      rgba[i * 4] = decoded.pixels[i * 3];
      rgba[i * 4 + 1] = decoded.pixels[i * 3 + 1];
      rgba[i * 4 + 2] = decoded.pixels[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    return { width: decoded.width, height: decoded.height, colorType: 6, pixels: rgba };
  }
  throw new Error(
    `colorType ${decoded.colorType} PNG has no reliable built-in palette - decode with decodePng ` +
    `and resolve its real palette yourself (see extract-sff-sprite.js)`
  );
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, rgba) {
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

module.exports = { decodePng, decodePngToRgba, indexedToRgba, encodeRgbaPng, pngChunk, SIGNATURE };
