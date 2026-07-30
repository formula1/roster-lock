import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { readJsonInput } from "../../src/lib/json-input";

const fooSchema = z.object({ foo: z.string() }).strict();

describe("readJsonInput", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-json-input-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads, parses, and validates JSON from a file path", async () => {
    const filePath = pathJoin(tempDir, "data.json");
    writeFileSync(filePath, JSON.stringify({ foo: "bar" }));

    await expect(readJsonInput(filePath, fooSchema)).resolves.toEqual({ foo: "bar" });
  });

  it("collects, parses, and validates JSON from stdin when given \"-\"", async () => {
    const originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", {
      value: Readable.from([JSON.stringify({ foo: "stdin" })]),
      configurable: true,
    });

    try {
      await expect(readJsonInput("-", fooSchema)).resolves.toEqual({ foo: "stdin" });
    } finally {
      Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
    }
  });

  it("throws on invalid JSON", async () => {
    const filePath = pathJoin(tempDir, "bad.json");
    writeFileSync(filePath, "{not valid json");

    await expect(readJsonInput(filePath, fooSchema)).rejects.toThrow();
  });

  it("throws a ZodError when the JSON doesn't match the schema", async () => {
    const filePath = pathJoin(tempDir, "wrong-shape.json");
    writeFileSync(filePath, JSON.stringify({ foo: 42 }));

    await expect(readJsonInput(filePath, fooSchema)).rejects.toThrow(z.ZodError);
  });

  it("rejects unknown properties (schemas are declared .strict())", async () => {
    const filePath = pathJoin(tempDir, "extra-props.json");
    writeFileSync(filePath, JSON.stringify({ foo: "bar", extra: true }));

    await expect(readJsonInput(filePath, fooSchema)).rejects.toThrow(z.ZodError);
  });
});
