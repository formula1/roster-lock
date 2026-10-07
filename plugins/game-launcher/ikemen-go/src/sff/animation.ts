// Renders one .air action into a single looping GIF - the piece that turns
// "a list of sprite references" into something a browser can play.

import { decodeSprite, DecodedSprite } from "./index";
import { AirFrame } from "./air";
import { encodeGif, quantizeToSharedPalette, GifFrame } from "./gif";

// MUGEN's clock. GIF delays are in centiseconds, hence the 100/60.
const TICKS_PER_SECOND = 60;
// A frame with ticks -1 says "hold here forever", i.e. the animation doesn't
// loop. A preview does loop, so give that frame a long beat instead of
// freezing on it.
const HOLD_FOREVER_CENTISECONDS = 100;

type Placed = { sprite: DecodedSprite, left: number, top: number, frame: AirFrame };

// Where a frame's sprite sits relative to the animation's origin. The sprite's
// axis is its own origin, so it hangs up and to the left of it - and a flip
// mirrors the sprite about that axis, which moves the box as well as the
// pixels.
function placeFrame(sprite: DecodedSprite, frame: AirFrame): { left: number, top: number } {
  return {
    left: (frame.flipX ? sprite.axisX - sprite.width : -sprite.axisX) + frame.offsetX,
    top: (frame.flipY ? sprite.axisY - sprite.height : -sprite.axisY) + frame.offsetY,
  };
}

function compose(placed: Placed, canvasWidth: number, canvasHeight: number, originX: number, originY: number): Buffer {
  const { sprite, frame } = placed;
  const canvas = Buffer.alloc(canvasWidth * canvasHeight * 4);
  const baseX = placed.left - originX;
  const baseY = placed.top - originY;

  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const sourceX = frame.flipX ? sprite.width - 1 - x : x;
      const sourceY = frame.flipY ? sprite.height - 1 - y : y;
      const source = (sourceY * sprite.width + sourceX) * 4;
      if (sprite.rgba[source + 3] === 0) continue;
      const canvasX = baseX + x;
      const canvasY = baseY + y;
      if (canvasX < 0 || canvasY < 0 || canvasX >= canvasWidth || canvasY >= canvasHeight) continue;
      sprite.rgba.copy(canvas, (canvasY * canvasWidth + canvasX) * 4, source, source + 4);
    }
  }
  return canvas;
}

function delayFor(ticks: number): number {
  if (ticks < 0) return HOLD_FOREVER_CENTISECONDS;
  return Math.round((ticks * 100) / TICKS_PER_SECOND);
}

export type RenderAnimationOptions = {
  // Guards the size of the data URI this ends up as. A long animation of
  // large sprites (kfm720's stance frames are 188x424) would otherwise
  // produce a preview measured in hundreds of kilobytes, once per card.
  maxFrames?: number,
};

/**
 * Decodes each frame's sprite, lays them all out on one canvas big enough for
 * the whole animation, and encodes the result as a looping GIF.
 *
 * Frames whose sprite is missing or uses a format the decoder doesn't handle
 * are dropped rather than failing the whole animation - one bad frame
 * shouldn't cost a character its preview. Throws only if nothing at all
 * decoded.
 */
export function renderAnimationToGif(
  sff: Buffer, frames: Array<AirFrame>, options: RenderAnimationOptions = {}
): Buffer {
  const { maxFrames } = options;
  const wanted = maxFrames === undefined ? frames : frames.slice(0, maxFrames);

  // An action replays the same sprite repeatedly (kfm's stance walks 0,0..0,5
  // and back down again), so decoding is worth caching within one render.
  const decoded = new Map<string, DecodedSprite | null>();
  const placed: Array<Placed> = [];
  for (const frame of wanted) {
    const key = `${frame.group},${frame.number}`;
    if (!decoded.has(key)) {
      try {
        decoded.set(key, decodeSprite(sff, frame.group, frame.number));
      } catch {
        decoded.set(key, null);
      }
    }
    const sprite = decoded.get(key);
    if (!sprite) continue;
    placed.push({ sprite, frame, ...placeFrame(sprite, frame) });
  }
  if (placed.length === 0) throw new Error("no frame of this animation could be decoded");

  const originX = Math.min(...placed.map((p) => p.left));
  const originY = Math.min(...placed.map((p) => p.top));
  const width = Math.max(...placed.map((p) => p.left + p.sprite.width)) - originX;
  const height = Math.max(...placed.map((p) => p.top + p.sprite.height)) - originY;

  const canvases = placed.map((p) => compose(p, width, height, originX, originY));
  const { palette, frames: indexed } = quantizeToSharedPalette(canvases);
  const gifFrames: Array<GifFrame> = indexed.map((indexes, i) => ({
    indexes, delayCentiseconds: delayFor(placed[i].frame.ticks),
  }));

  return encodeGif(width, height, palette, gifFrames);
}
