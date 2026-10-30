import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderAnimationToGif } from "../src/sff/animation";
import { readAction, AirFrame } from "../src/sff/air";
import { decodeSprite } from "../src/sff";

const PIECES_DIR = join(__dirname, "../../../../examples/mugen/pieces");
const kfmSff = readFileSync(join(PIECES_DIR, "chars/kfm/kfm.sff"));
const kfmAir = readFileSync(join(PIECES_DIR, "chars/kfm/kfm.air"), "utf-8");

// Just enough GIF reading to check structure and timing - the pixel-level
// round trip lives in gif.test.ts.
function readGif(gif: Buffer) {
  const frames: Array<number> = [];
  for (let i = 0; i < gif.length - 3; i++) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 0x04) frames.push(gif.readUInt16LE(i + 4));
  }
  return { signature: gif.subarray(0, 6).toString("ascii"), width: gif.readUInt16LE(6), height: gif.readUInt16LE(8), delays: frames };
}

describe("renderAnimationToGif", () => {
  it("renders kfm's stance as a looping GIF, one frame per .air line", () => {
    const frames = readAction(kfmAir, 0)!;
    const gif = renderAnimationToGif(kfmSff, frames);
    const read = readGif(gif);

    expect(read.signature).toBe("GIF89a");
    expect(read.delays).toHaveLength(frames.length);
    // MUGEN ticks are 1/60s, GIF delays 1/100s.
    expect(read.delays).toEqual(frames.map((f) => Math.round((f.ticks * 100) / 60)));
    // NETSCAPE2.0 with a zero loop count is the only way to say "forever".
    expect(gif.includes(Buffer.from("NETSCAPE2.0", "ascii"))).toBe(true);
  });

  it("sizes the canvas to the union of every frame, aligned on each sprite's axis", () => {
    const frames = readAction(kfmAir, 0)!;
    const sprites = frames.map((f) => decodeSprite(kfmSff, f.group, f.number));
    // kfm's stance frames vary in width (47..51) - a canvas sized off one
    // frame, or laid out without the axis, would crop or jitter the rest.
    expect(new Set(sprites.map((s) => s.width)).size).toBeGreaterThan(1);

    const lefts = sprites.map((s) => -s.axisX);
    const tops = sprites.map((s) => -s.axisY);
    const expectedWidth = Math.max(...sprites.map((s, i) => lefts[i] + s.width)) - Math.min(...lefts);
    const expectedHeight = Math.max(...sprites.map((s, i) => tops[i] + s.height)) - Math.min(...tops);

    const read = readGif(renderAnimationToGif(kfmSff, frames));
    expect([read.width, read.height]).toEqual([expectedWidth, expectedHeight]);
  });

  it("honours maxFrames so one long animation can't blow up the data URI", () => {
    const frames = readAction(kfmAir, 0)!;
    expect(readGif(renderAnimationToGif(kfmSff, frames, { maxFrames: 3 })).delays).toHaveLength(3);
  });

  it("skips frames whose sprite is missing rather than losing the whole animation", () => {
    const frames: Array<AirFrame> = [
      { group: 0, number: 0, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false },
      { group: 4242, number: 7, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false },
      { group: 0, number: 1, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false },
    ];
    expect(readGif(renderAnimationToGif(kfmSff, frames)).delays).toHaveLength(2);
  });

  it("throws when no frame at all could be decoded", () => {
    const frames: Array<AirFrame> = [
      { group: 4242, number: 7, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false },
    ];
    expect(() => renderAnimationToGif(kfmSff, frames)).toThrow(/could be decoded/);
  });

  it("gives a hold-forever frame a real delay instead of a zero-length one", () => {
    const frames: Array<AirFrame> = [
      { group: 0, number: 0, offsetX: 0, offsetY: 0, ticks: -1, flipX: false, flipY: false },
    ];
    expect(readGif(renderAnimationToGif(kfmSff, frames)).delays[0]).toBeGreaterThan(50);
  });

  it("mirrors a flipped frame about the axis, moving its box with it", () => {
    const base: AirFrame = { group: 0, number: 0, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false };
    const sprite = decodeSprite(kfmSff, 0, 0);
    // Unflipped the sprite hangs left of the axis; flipped it hangs right, so
    // playing both needs a canvas spanning the two.
    const both = readGif(renderAnimationToGif(kfmSff, [base, { ...base, flipX: true }]));
    const expectedWidth = Math.max(-sprite.axisX + sprite.width, sprite.axisX)
      - Math.min(-sprite.axisX, sprite.axisX - sprite.width);
    expect(both.width).toBe(expectedWidth);
    expect(both.width).toBeGreaterThan(sprite.width);
  });
});
