import { describe, it, expect } from "vitest";
import { calculatePieceVersion, normalizePiecePath } from "../../src";

const logic = { name: "logic", classification: "logic", count: "*", glob: ["**/*.js"] } as const;
const media = { name: "media", classification: "media", count: "*", glob: ["**/*.png"] } as const;

async function versionOf(files: Record<string, string>) {
  const map = new Map(Object.keys(files).map((path) => [
    path, { assets: [path.endsWith(".js") ? logic : media] as any },
  ]));
  return calculatePieceVersion(map, async (path) => {
    const bytes = new TextEncoder().encode(files[path]);
    return { byteSize: bytes.byteLength, stream: (async function* () { yield bytes; })() };
  });
}

const EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("calculatePieceVersion", () => {
  it("doesn't depend on the order files are listed in", async () => {
    const a = await versionOf({ "a.js": "1", "b.js": "2", "x.png": "p" });
    const b = await versionOf({ "x.png": "p", "b.js": "2", "a.js": "1" });
    expect(a).toEqual(b);
  });

  it("changes when a file is renamed", async () => {
    const before = await versionOf({ "a.js": "1" });
    const after = await versionOf({ "renamed.js": "1" });
    expect(after.logic).not.toBe(before.logic);
  });

  it("changes when two files swap contents", async () => {
    const before = await versionOf({ "front.png": "F", "back.png": "B" });
    const after = await versionOf({ "front.png": "B", "back.png": "F" });
    expect(after.media).not.toBe(before.media);
  });

  it("keeps classifications independent", async () => {
    const before = await versionOf({ "a.js": "1", "x.png": "p" });
    const after = await versionOf({ "a.js": "1", "x.png": "changed" });
    expect(after.logic).toBe(before.logic);
    expect(after.media).not.toBe(before.media);
  });

  it("treats ./ and backslash paths as the same file", async () => {
    expect(await versionOf({ "./dir\\a.js": "1" })).toEqual(await versionOf({ "dir/a.js": "1" }));
    expect(normalizePiecePath("./a/b")).toBe("a/b");
  });

  it("hashes an empty classification as the hash of nothing", async () => {
    expect((await versionOf({ "a.js": "1" })).media).toBe(EMPTY_SHA);
  });

  it("names the file and the cause when a file can't be read", async () => {
    const files = new Map([["a.js", { assets: [logic] as any }]]);
    await expect(calculatePieceVersion(files, async () => { throw new Error("EACCES"); }))
      .rejects.toThrow("Failed to hash a.js: EACCES");
  });

  it("refuses a file whose size changed while it was read", async () => {
    const files = new Map([["a.js", { assets: [logic] as any }]]);
    await expect(calculatePieceVersion(files, async () => ({
      byteSize: 1, stream: (async function* () { yield new Uint8Array(2); })(),
    }))).rejects.toThrow(/larger than its reported/);
  });
});
