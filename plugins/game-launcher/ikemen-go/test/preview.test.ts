import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readDefKey } from "../src/sff/defFile";
import { getPreview, useDefaultPreview } from "../src/preview";
import { CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE } from "../src/pieceTypes";
import { decodePng } from "../src/sff/png";

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
