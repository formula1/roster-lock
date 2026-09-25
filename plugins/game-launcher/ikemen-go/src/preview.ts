import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { PiecePreview } from "@roster-lock/types";
import { CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE } from "./pieceTypes";
import { readDefKey } from "./sff/defFile";
import { decodeSpriteToPng } from "./sff";

// Sprite group,number conventions - characters store their select/vs-screen
// portrait at group 9000 (9000,1 is the larger select-screen portrait, tried
// first; 9000,0 a smaller one some characters use instead). Stages have no
// real "preview sprite" convention, so this is a best-effort guess: group 0
// is the near-universal background-layer sprite group in [BGdef] (see
// pieces/stages/stage0/stage0.def's `spriteno = 0, 0`/`spriteno = 0, 1`
// background elements).
const CHARACTER_SPRITE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [[9000, 1], [9000, 0]];
const STAGE_SPRITE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [[0, 0]];

// A piece's .sff isn't reliably `<defName>.sff` - the .def is the source of
// truth for its own asset filenames (a character's .def has a [Files]
// section with `sprite = <name>.sff`, a stage's has [BGdef]/`spr = <name>.sff`
// - confirmed against this repo's own kfm.def/stage0.def fixtures).
async function resolveSffPath(pieceFolder: string, pieceType: string, defName: string): Promise<string | undefined> {
  const defPath = join(pieceFolder, `${defName}.def`);
  if (!existsSync(defPath)) return undefined;
  const contents = await readFile(defPath, "utf-8");
  const [section, key] = pieceType === CHARACTER_PIECE_TYPE ? ["Files", "sprite"] : ["BGdef", "spr"];
  const sffName = readDefKey(contents, section, key);
  if (!sffName) return undefined;
  const sffPath = join(pieceFolder, sffName);
  return existsSync(sffPath) ? sffPath : undefined;
}

export async function getPreview(
  pieceType: string, pathVariables: Record<string, string>, pieceFolder: string
): Promise<PiecePreview | undefined> {
  const defName = pathVariables[DEF_NAME_VARIABLE];
  if (!defName) return undefined;
  const sffPath = await resolveSffPath(pieceFolder, pieceType, defName);
  if (!sffPath) return undefined;

  const buf = await readFile(sffPath);
  const candidates = pieceType === CHARACTER_PIECE_TYPE ? CHARACTER_SPRITE_CANDIDATES
    : pieceType === STAGE_PIECE_TYPE ? STAGE_SPRITE_CANDIDATES : [];
  for (const [group, number] of candidates) {
    try {
      const png = decodeSpriteToPng(buf, group, number);
      return { kind: "image", dataUri: `data:image/png;base64,${png.toString("base64")}` };
    } catch {
      // try the next candidate - unsupported format, sprite missing, etc.
    }
  }
  return undefined;
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
