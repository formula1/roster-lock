import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { walkRelative, getFileFromRoot } from "../../src/lib/fs-walk";

describe("fs-walk", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-fs-walk-"));
    mkdirSync(pathJoin(tempDir, "nested"));
    writeFileSync(pathJoin(tempDir, "top.txt"), "top");
    writeFileSync(pathJoin(tempDir, "nested", "inner.txt"), "inner");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("yields all files recursively as forward-slash relative paths", async () => {
    const paths: Array<string> = [];
    for await (const p of walkRelative(tempDir)) paths.push(p);
    expect(paths.sort()).toEqual(["nested/inner.txt", "top.txt"]);
  });

  it("resolves file size and a readable stream from root", async () => {
    const { byteSize, stream } = await getFileFromRoot(tempDir, "top.txt");
    expect(byteSize).toBe(3);

    const chunks: Array<Buffer> = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf-8")).toBe("top");
  });
});
