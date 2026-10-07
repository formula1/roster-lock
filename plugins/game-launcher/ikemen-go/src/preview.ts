import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { PiecePreview } from "@roster-lock/types";
import { CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE } from "./pieceTypes";
import { readDefKey } from "./sff/defFile";
import { decodeSpriteToPng } from "./sff";
import { readAction } from "./sff/air";
import { renderAnimationToGif } from "./sff/animation";

// Sprite group,number conventions - characters store their select/vs-screen
// portrait at group 9000 (9000,1 is the larger select-screen portrait, tried
// first; 9000,0 a smaller one some characters use instead). 0,0 is the last
// resort: group 0 is the idle-stance animation every character has, so a
// character that ships no 9000 portrait at all still gets a real preview
// (a full-body standing sprite) rather than none.
const CHARACTER_SPRITE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [[9000, 1], [9000, 0], [0, 0]];

// Stages have no real "preview sprite" convention, so this is a best-effort
// guess: group 0 is the near-universal background-layer sprite group in
// [BGdef] (see pieces/stages/stage0/stage0.def's `spriteno = 0, 0`/
// `spriteno = 0, 1` background elements).
const STAGE_SPRITE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [[0, 0]];

// Overrides what a character preview is made of. Accepted values:
//
//   portrait            the candidates above (the default, and what unset means)
//   stance              the .air standing animation (action 0), as a looping GIF
//   action:<n>          that .air action, as a looping GIF
//   <group>,<number> …  those sprites, still, in order (space/semicolon separated)
//
// This exists to make the pipeline verifiable by eye. Every character in a
// typical roster has a near-identical head-and-shoulders 9000,1 portrait (the
// six kfm variants in examples/mugen/pieces are indistinguishable at that
// group), so a selection screen full of working previews looks much the same
// as one full of a placeholder - a moving stance, or an obviously different
// sprite, is how you confirm the pixels really came out of each piece's own
// files. Deliberately a replacement, not an extra fallback: silently falling
// back to 9000,1 would defeat the check. Stages are unaffected.
const PREVIEW_MODE_ENV = "ROSTERLOCK_IKEMEN_CHARACTER_PREVIEW";

// MUGEN's standing/idle animation, by convention.
const STANCE_ACTION = 0;

// Caps how much animation ends up inside a data URI that the selection screen
// then holds once per card. kfm's stance is 11 frames; a character with a long
// one and large sprites (kfm720's stance frames are 188x424) would otherwise
// produce a preview measured in hundreds of kilobytes.
const MAX_ANIMATION_FRAMES = 24;

export type CharacterPreviewMode =
  | { kind: "sprites", candidates: ReadonlyArray<readonly [number, number]> }
  | { kind: "animation", action: number };

// Both halves are unsigned in the SFF sprite header (readUInt16LE in
// sff/header.ts), so digits only - no sign, no "9000," meaning 9000,0.
const SPRITE_PAIR = /^(\d+),(\d+)$/;

export function parseCharacterPreviewMode(raw: string): CharacterPreviewMode {
  const value = raw.trim();
  if (value.toLowerCase() === "portrait") return { kind: "sprites", candidates: CHARACTER_SPRITE_CANDIDATES };
  if (value.toLowerCase() === "stance") return { kind: "animation", action: STANCE_ACTION };

  const action = /^action:(-?\d+)$/i.exec(value);
  if (action) return { kind: "animation", action: Number(action[1]) };

  const candidates = value.split(/[;\s]+/).filter(Boolean).map((entry) => {
    const match = SPRITE_PAIR.exec(entry);
    if (!match) {
      throw new Error(
        `${PREVIEW_MODE_ENV}="${raw}" is not understood - expected "portrait", "stance", "action:<n>", `
        + `or a list of "group,number" pairs`
      );
    }
    return [Number(match[1]), Number(match[2])] as const;
  });
  if (candidates.length === 0) throw new Error(`${PREVIEW_MODE_ENV} is set but names nothing`);
  return { kind: "sprites", candidates };
}

function characterPreviewMode(): CharacterPreviewMode {
  const override = process.env[PREVIEW_MODE_ENV];
  return override ? parseCharacterPreviewMode(override) : { kind: "sprites", candidates: CHARACTER_SPRITE_CANDIDATES };
}

// A piece's assets aren't reliably named after its .def - the .def is the
// source of truth for its own filenames (a character's has a [Files] section
// with `sprite = <name>.sff` and `anim = <name>.air`, a stage's has
// [BGdef]/`spr = <name>.sff` - confirmed against this repo's own
// kfm.def/kfm.air/stage0.def fixtures).
function resolveAssetPath(pieceFolder: string, def: string, section: string, key: string): string | undefined {
  const name = readDefKey(def, section, key);
  if (!name) return undefined;
  const path = join(pieceFolder, name);
  return existsSync(path) ? path : undefined;
}

export async function getPreview(
  pieceType: string, pathVariables: Record<string, string>, pieceFolder: string
): Promise<PiecePreview | undefined> {
  if (pieceType !== CHARACTER_PIECE_TYPE && pieceType !== STAGE_PIECE_TYPE) return undefined;
  const defName = pathVariables[DEF_NAME_VARIABLE];
  if (!defName) return undefined;
  const defPath = join(pieceFolder, `${defName}.def`);
  if (!existsSync(defPath)) return undefined;
  const def = await readFile(defPath, "utf-8");

  const sffPath = resolveAssetPath(pieceFolder, def, pieceType === CHARACTER_PIECE_TYPE ? "Files" : "BGdef",
    pieceType === CHARACTER_PIECE_TYPE ? "sprite" : "spr");
  if (!sffPath) return undefined;
  const sff = await readFile(sffPath);

  const mode: CharacterPreviewMode = pieceType === CHARACTER_PIECE_TYPE
    ? characterPreviewMode()
    : { kind: "sprites", candidates: STAGE_SPRITE_CANDIDATES };

  if (mode.kind === "animation") return animationPreview(sff, def, pieceFolder, mode.action);

  for (const [group, number] of mode.candidates) {
    try {
      const png = decodeSpriteToPng(sff, group, number);
      return { kind: "image", dataUri: `data:image/png;base64,${png.toString("base64")}` };
    } catch {
      // try the next candidate - unsupported format, sprite missing, etc.
    }
  }
  return undefined;
}

// A looping GIF of one .air action. The .air is named by the same [Files]
// section as the .sff, and can be missing entirely (a stage, a stripped-down
// character) - in which case there's no animation to give.
async function animationPreview(
  sff: Buffer, def: string, pieceFolder: string, action: number
): Promise<PiecePreview | undefined> {
  const airPath = resolveAssetPath(pieceFolder, def, "Files", "anim");
  if (!airPath) return undefined;
  const frames = readAction(await readFile(airPath, "utf-8"), action);
  if (!frames) return undefined;
  try {
    const gif = renderAnimationToGif(sff, frames, { maxFrames: MAX_ANIMATION_FRAMES });
    return { kind: "image", dataUri: `data:image/gif;base64,${gif.toString("base64")}` };
  } catch {
    // Same contract as a sprite that won't decode - no preview, not an error.
    return undefined;
  }
}

// Static, piece-independent placeholder shown while a piece hasn't been
// downloaded yet at all (see GameLauncherPlugin["useDefaultPreview"]'s docs -
// getPreview has no folder to read from in that case). Read off disk and
// base64-encoded on first use, then cached - match-agent may call this once
// per hover.
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const cachedAssets: Record<string, Promise<string>> = {}
const assetFilePerPieceType: Record<string, string> = {
  [CHARACTER_PIECE_TYPE]: "./assets/default-fighter-flyingkick.jpeg",
  [STAGE_PIECE_TYPE]: "./assets/default-stage-theater.jpeg",
}
async function loadDefaultPreviewDataUri(pieceType: string): Promise<undefined | string> {
  if(pieceType in cachedAssets) return cachedAssets[pieceType]
  if(!(pieceType in assetFilePerPieceType)) return;
  const filePath = assetFilePerPieceType[pieceType];
  const mimeType = MIME_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()];
  if(!mimeType) throw new Error(`No known mime type for default preview asset "${filePath}"`);
  cachedAssets[pieceType] = Promise.resolve().then(async ()=>{
    const buf = await readFile(join(__dirname, "../", filePath))
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  });

  return cachedAssets[pieceType];
}

// pieceType is unused for now - the same placeholder covers both character
// and stage pieces; splitting into two is a pure content change later if
// wanted, not a structural one.
export async function useDefaultPreview(pieceType: string): Promise<PiecePreview | undefined> {
  const dataUri = await loadDefaultPreviewDataUri(pieceType);
  if(typeof dataUri === "undefined") return; 
  return { kind: "image", dataUri };
}
