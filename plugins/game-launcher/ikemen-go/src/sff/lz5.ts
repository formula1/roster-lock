// SFF v2 sprite format 4 (LZ5) decoder - ported directly from Ikemen-GO's own
// Lz5Decode (src/image.go), not reverse-engineered: this is Elecbyte's custom
// LZ77-style scheme and this repo has no independent decoder to validate a
// from-scratch implementation against, so porting the engine's own decode
// logic bit-for-bit is the only reliable option. Decodes to indexed
// (palette-index) bytes, same as rle8Decode.
//
// One deliberate addition over the ported original: a back-reference that
// would read before the start of the output (p[j - d] with d > j) throws
// here instead of silently reading `undefined`/producing garbage - malformed
// input should fail loudly rather than hand back a corrupted image.
export function lz5Decode(rle: Buffer, outputLength: number): Buffer {
  const p = Buffer.alloc(outputLength);
  if (rle.length === 0) return p;
  let i = 0;
  let j = 0;
  let n = 0;
  let ct = rle[i];
  let cts = 0;
  let rb = 0;
  let rbc = 0;
  if (i < rle.length - 1) i++;

  while (j < p.length) {
    let d = rle[i];
    if (i < rle.length - 1) i++;

    if ((ct & (1 << cts)) !== 0) {
      if ((d & 0x3f) === 0) {
        d = ((d << 2) | rle[i]) + 1;
        if (i < rle.length - 1) i++;
        n = rle[i] + 2;
        if (i < rle.length - 1) i++;
      } else {
        rb = (rb | ((d & 0xc0) >> rbc)) & 0xff;
        rbc += 2;
        n = d & 0x3f;
        if (rbc < 8) {
          d = rle[i] + 1;
          if (i < rle.length - 1) i++;
        } else {
          d = rb + 1;
          rb = 0;
          rbc = 0;
        }
      }
      for (;;) {
        if (j < p.length) {
          if (j - d < 0) throw new Error("LZ5 back-reference reads before the start of output (malformed data)");
          p[j] = p[j - d];
          j++;
        }
        n--;
        if (n < 0) break;
      }
    } else {
      if ((d & 0xe0) === 0) {
        n = rle[i] + 8;
        if (i < rle.length - 1) i++;
      } else {
        n = d >> 5;
        d &= 0x1f;
      }
      for (; n > 0; n--) {
        if (j < p.length) {
          p[j] = d;
          j++;
        }
      }
    }

    cts++;
    if (cts >= 8) {
      ct = rle[i];
      cts = 0;
      if (i < rle.length - 1) i++;
    }
  }
  return p;
}
