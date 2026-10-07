import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAction } from "../src/sff/air";

const PIECES_DIR = join(__dirname, "../../../../examples/mugen/pieces");
const kfmAir = readFileSync(join(PIECES_DIR, "chars/kfm/kfm.air"), "utf-8");

describe("readAction", () => {
  it("reads the stance (action 0) out of a real .air, skipping Clsn lines and comments", () => {
    const frames = readAction(kfmAir, 0);
    // kfm.air's Action 0 walks 0,0..0,5 and back down to 0,0 - eleven frames,
    // with a long hold on 0,5 and another on the closing 0,0.
    expect(frames).toEqual([
      { group: 0, number: 0, offsetX: 0, offsetY: 0, ticks: 10, flipX: false, flipY: false },
      { group: 0, number: 1, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 2, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 3, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 4, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 5, offsetX: 0, offsetY: 0, ticks: 45, flipX: false, flipY: false },
      { group: 0, number: 4, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 3, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 2, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 1, offsetX: 0, offsetY: 0, ticks: 7, flipX: false, flipY: false },
      { group: 0, number: 0, offsetX: 0, offsetY: 0, ticks: 40, flipX: false, flipY: false },
    ]);
  });

  it("stops at the next action rather than running into it", () => {
    // Action 5 (turning) is the very next block after action 0 in kfm.air.
    expect(readAction(kfmAir, 5)).toHaveLength(2);
  });

  it("reads the flip flag on a frame that has one", () => {
    // kfm.air's turning animation is `5,0, 0,0, 4, H` then the same unflipped.
    const frames = readAction(kfmAir, 5)!;
    expect(frames[0].flipX).toBe(true);
    expect(frames[1].flipX).toBe(false);
  });

  it("returns undefined for an action the file doesn't have", () => {
    expect(readAction(kfmAir, 31337)).toBeUndefined();
  });

  it("reads offsets, negative ticks and a V flip", () => {
    const frames = readAction("[Begin Action 7]\n1,2, -3,4, -1, V\n", 7);
    expect(frames).toEqual([
      { group: 1, number: 2, offsetX: -3, offsetY: 4, ticks: -1, flipX: false, flipY: true },
    ]);
  });

  it("ignores loop markers, interpolation directives and blend flags", () => {
    const frames = readAction(
      "[Begin Action 3]\nLoopstart\nInterpolate Offset\n9,0, 0,0, 5, , AS128D128\n", 3
    );
    expect(frames).toEqual([
      { group: 9, number: 0, offsetX: 0, offsetY: 0, ticks: 5, flipX: false, flipY: false },
    ]);
  });

  it("treats an action with no frame lines as absent", () => {
    expect(readAction("[Begin Action 2]\nClsn2Default: 1\n Clsn2[0] = 1,2,3,4\n[Begin Action 3]\n", 2))
      .toBeUndefined();
  });
});
