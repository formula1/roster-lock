import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readDefKey } from "../src/sff/defFile";
import { getPreview, useDefaultPreview, parseCharacterPreviewMode } from "../src/preview";
import { CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE } from "../src/pieceTypes";
import { decodePng } from "../src/sff/png";
import { decodeSpriteToPng } from "../src/sff";

const PREVIEW_MODE_ENV = "ROSTERLOCK_IKEMEN_CHARACTER_PREVIEW";

// `await run()` inside the try, not `return run()`: getPreview reads the env
// var after its first await, so unsetting it when the *call* returns rather
// than when its promise settles would clear it before it was ever read.
async function withPreviewMode<T>(mode: string, run: () => Promise<T>): Promise<T> {
  process.env[PREVIEW_MODE_ENV] = mode;
  try {
    return await run();
  } finally {
    delete process.env[PREVIEW_MODE_ENV];
  }
}

const PIECES_DIR = join(__dirname, "../../../../examples/mugen/pieces");

describe("readDefKey", () => {
  const kfmDef = readFileSync(join(PIECES_DIR, "chars/kfm/kfm.def"), "utf-8");
  const stageDef = readFileSync(join(PIECES_DIR, "stages/stage0/stage0.def"), "utf-8");

  it("reads [Files]/sprite out of a real character .def", () => {
    expect(readDefKey(kfmDef, "Files", "sprite")).toBe("kfm.sff");
  });

  it("reads [BGdef]/spr out of a real stage .def", () => {
    expect(readDefKey(stageDef, "BGdef", "spr")).toBe("stage0.sff");
  });

  it("returns undefined for a missing key", () => {
    expect(readDefKey(kfmDef, "Files", "not-a-real-key")).toBeUndefined();
  });

  it("returns undefined for a missing section", () => {
    expect(readDefKey(kfmDef, "NotASection", "sprite")).toBeUndefined();
  });
});

describe("getPreview", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "ikemen-preview-"));
    cpSync(join(PIECES_DIR, "chars/kfm"), join(fixtureDir, "kfm-piece"), { recursive: true });
    cpSync(join(PIECES_DIR, "stages/stage0"), join(fixtureDir, "stage0-piece"), { recursive: true });
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("prefers 9000,1 over 9000,0 for a character, falling back through candidates", async () => {
    const preview = await getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    );
    expect(preview?.kind).toBe("image");
    if (preview?.kind !== "image") throw new Error("expected an image preview");
    const png = Buffer.from(preview.dataUri.split(",")[1], "base64");
    // kfm.sff's 9000,1 (RLE8) is the one actually decoded first.
    expect(decodePng(png).width).toBeGreaterThan(0);
  });

  it("reads the sprite named by the character override instead of the portrait", async () => {
    // 0,0 is the idle-stance sprite - visibly a whole standing character
    // rather than the head-and-shoulders 9000,1 portrait, which is the point
    // of the override (see PREVIEW_MODE_ENV's note in src/preview.ts).
    const preview = await withPreviewMode("0,0", () => getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    ));
    if (preview?.kind !== "image") throw new Error("expected an image preview");
    const sff = readFileSync(join(fixtureDir, "kfm-piece/kfm.sff"));
    const expected = decodeSpriteToPng(sff, 0, 0);
    expect(Buffer.from(preview.dataUri.split(",")[1], "base64").equals(expected)).toBe(true);
  });

  it("returns the stance as an animated GIF in stance mode", async () => {
    const preview = await withPreviewMode("stance", () => getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    ));
    if (preview?.kind !== "image") throw new Error("expected an image preview");
    // A GIF, not a PNG - that's what makes it play in a plain <img> with no
    // change anywhere in the selection screen.
    expect(preview.dataUri.startsWith("data:image/gif;base64,")).toBe(true);
    const gif = Buffer.from(preview.dataUri.split(",")[1], "base64");
    expect(gif.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    // Eleven frames, one per line of kfm.air's Action 0.
    const frameCount = gif.reduce(
      (count, byte, i) => count + (byte === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 0x04 ? 1 : 0), 0
    );
    expect(frameCount).toBe(11);
  });

  it("reads any other action by number", async () => {
    const preview = await withPreviewMode("action:5", () => getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    ));
    expect(preview?.kind).toBe("image");
    if (preview?.kind !== "image") throw new Error("expected an image preview");
    expect(preview.dataUri.startsWith("data:image/gif;base64,")).toBe(true);
  });

  it("gives no preview for an action the character doesn't have, rather than a still one", async () => {
    // Same reasoning as the missing-sprite case below - a silent fall-through
    // to the portrait would make the override useless as a check.
    expect(await withPreviewMode("action:31337", () => getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    ))).toBeUndefined();
  });

  it("does not fall back to the portrait when the override names a sprite the character lacks", async () => {
    // A silent fall-through to 9000,1 would make the override useless as a
    // check - you'd see a preview either way and learn nothing.
    expect(await withPreviewMode("61234,7", () => getPreview(
      CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece")
    ))).toBeUndefined();
  });

  it("leaves stages on their own candidate list when the character override is set", async () => {
    const preview = await withPreviewMode("stance", () => getPreview(
      STAGE_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "stage0" }, join(fixtureDir, "stage0-piece")
    ));
    expect(preview?.kind).toBe("image");
    if (preview?.kind !== "image") throw new Error("expected an image preview");
    expect(preview.dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("returns a stage preview via the best-effort group 0,0 background sprite", async () => {
    const preview = await getPreview(
      STAGE_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "stage0" }, join(fixtureDir, "stage0-piece")
    );
    expect(preview?.kind).toBe("image");
  });

  it("returns undefined when pathVariables has no defName", async () => {
    expect(await getPreview(CHARACTER_PIECE_TYPE, {}, join(fixtureDir, "kfm-piece"))).toBeUndefined();
  });

  it("returns undefined when the .def doesn't exist in the folder", async () => {
    expect(
      await getPreview(CHARACTER_PIECE_TYPE, { [DEF_NAME_VARIABLE]: "nope" }, join(fixtureDir, "kfm-piece"))
    ).toBeUndefined();
  });

  it("returns undefined for an unrecognized pieceType", async () => {
    expect(
      await getPreview("weapon", { [DEF_NAME_VARIABLE]: "kfm" }, join(fixtureDir, "kfm-piece"))
    ).toBeUndefined();
  });
});

describe("parseCharacterPreviewMode", () => {
  it("understands the named modes", () => {
    expect(parseCharacterPreviewMode("stance")).toEqual({ kind: "animation", action: 0 });
    expect(parseCharacterPreviewMode("STANCE")).toEqual({ kind: "animation", action: 0 });
    expect(parseCharacterPreviewMode("action:12")).toEqual({ kind: "animation", action: 12 });
    expect(parseCharacterPreviewMode("portrait")).toEqual({
      kind: "sprites", candidates: [[9000, 1], [9000, 0], [0, 0]],
    });
  });

  it("reads space- and semicolon-separated group,number pairs", () => {
    expect(parseCharacterPreviewMode("0,0")).toEqual({ kind: "sprites", candidates: [[0, 0]] });
    expect(parseCharacterPreviewMode("9000,1 9000,0;0,0")).toEqual({
      kind: "sprites", candidates: [[9000, 1], [9000, 0], [0, 0]],
    });
  });

  it("rejects anything it doesn't understand", () => {
    for (const bad of ["0", "9000,", "a,b", "0,0,0", "-1,0", "   ", "action:", "stances"]) {
      expect(() => parseCharacterPreviewMode(bad)).toThrow();
    }
  });
});

describe("useDefaultPreview", () => {
  it("returns a distinct bundled placeholder per pieceType, with the right mime type", async () => {
    const characterPreview = await useDefaultPreview(CHARACTER_PIECE_TYPE);
    expect(characterPreview?.kind).toBe("image");
    if (characterPreview?.kind !== "image") throw new Error("expected an image preview");
    expect(characterPreview.dataUri.startsWith("data:image/jpeg;base64,")).toBe(true);

    const stagePreview = await useDefaultPreview(STAGE_PIECE_TYPE);
    expect(stagePreview?.kind).toBe("image");
    if (stagePreview?.kind !== "image") throw new Error("expected an image preview");
    expect(stagePreview.dataUri.startsWith("data:image/jpeg;base64,")).toBe(true);

    expect(characterPreview.dataUri).not.toBe(stagePreview.dataUri);
  });

  it("returns undefined for a pieceType with no configured default asset", async () => {
    expect(await useDefaultPreview("weapon")).toBeUndefined();
  });
});
