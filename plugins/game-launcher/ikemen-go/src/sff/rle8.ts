// SFF v2 sprite format 2 (RLE8) decoder - ported directly from Ikemen-GO's
// own Rle8Decode (src/image.go), not reverse-engineered, since this repo has
// no independent RLE8 decoder to validate a from-scratch implementation
// against. Decodes to indexed (palette-index) bytes, the same shape format
// 0's raw data already has - resolve through png.ts's indexedToRgba same as
// format 0.
export function rle8Decode(rle: Buffer, outputLength: number): Buffer {
  const p = Buffer.alloc(outputLength);
  if (rle.length === 0) return p;
  let i = 0;
  let j = 0;
  while (j < p.length) {
    let n = 1;
    let d = rle[i];
    if (i < rle.length - 1) i++;
    if ((d & 0xc0) === 0x40) {
      n = d & 0x3f;
      d = rle[i];
      if (i < rle.length - 1) i++;
    }
    for (; n > 0; n--) {
      if (j < p.length) {
        p[j] = d;
        j++;
      }
    }
  }
  return p;
}
