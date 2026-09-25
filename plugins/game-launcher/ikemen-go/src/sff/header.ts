// SFF v2 header/sprite-header parsing - ported from
// examples/mugen/utils/extract-sff-sprite.js (see that file's own notes on
// the byte layout, reverse-engineered against Ikemen-GO's src/image.go).

export type SffHeader = {
  firstSpriteOfs: number,
  numSprites: number,
  firstPalOfs: number,
  lofs: number,
  tofs: number,
};

export type SffSprite = {
  w: number,
  h: number,
  format: number,
  dataOfs: number,
  dataSize: number,
  palidx: number,
  flag: number,
};

const SFF_SIGNATURE = "ElecbyteSpr\x00";

export function readHeader(buf: Buffer): SffHeader {
  if (buf.toString("ascii", 0, 12) !== SFF_SIGNATURE) {
    throw new Error("not an SFF file (bad signature)");
  }
  return {
    firstSpriteOfs: buf.readUInt32LE(36),
    numSprites: buf.readUInt32LE(40),
    firstPalOfs: buf.readUInt32LE(44),
    lofs: buf.readUInt32LE(52),
    tofs: buf.readUInt32LE(60),
  };
}

export function findSprite(buf: Buffer, header: SffHeader, group: number, number: number): SffSprite {
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

// Palette data is NumColors*4 raw RGBA bytes (index 0 is MUGEN's usual
// transparent-index-0 convention, alpha already 0).
export function readPalette(buf: Buffer, header: SffHeader, palidx: number): Array<[number, number, number, number]> {
  const po = header.firstPalOfs + palidx * 16;
  const numColors = buf.readUInt16LE(po + 4);
  const ofs = buf.readUInt32LE(po + 8);
  const abs = header.lofs + ofs;
  const colors: Array<[number, number, number, number]> = [];
  for (let i = 0; i < numColors; i++) {
    const o = abs + i * 4;
    colors.push([buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]);
  }
  return colors;
}
