import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import {
  DRAFT_SUFFIX, resolveDraftPath, defaultDraftPath, readDraft, writeDraft,
} from "../../src/lib/draft-io";

describe("draft-io", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-draft-io-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("resolveDraftPath", () => {
    it("resolves an explicit path against cwd", () => {
      expect(resolveDraftPath("foo.rosterlock.draft.json")).toBe(pathJoin(tempDir, "foo.rosterlock.draft.json"));
    });

    it("finds the sole draft file in cwd", () => {
      writeFileSync(pathJoin(tempDir, `only${DRAFT_SUFFIX}`), "{}");
      expect(resolveDraftPath()).toBe(pathJoin(tempDir, `only${DRAFT_SUFFIX}`));
    });

    it("throws when no draft file is found", () => {
      expect(() => resolveDraftPath()).toThrow(/No draft file found/);
    });

    it("throws when multiple draft files are found", () => {
      writeFileSync(pathJoin(tempDir, `a${DRAFT_SUFFIX}`), "{}");
      writeFileSync(pathJoin(tempDir, `b${DRAFT_SUFFIX}`), "{}");
      expect(() => resolveDraftPath()).toThrow(/Multiple draft files found/);
    });
  });

  describe("defaultDraftPath", () => {
    it("slugifies the title", () => {
      expect(defaultDraftPath("My Game")).toBe(pathJoin(tempDir, `my-game${DRAFT_SUFFIX}`));
    });

    it("falls back to 'config' when no usable title is given", () => {
      expect(defaultDraftPath()).toBe(pathJoin(tempDir, `config${DRAFT_SUFFIX}`));
      expect(defaultDraftPath("!!!")).toBe(pathJoin(tempDir, `config${DRAFT_SUFFIX}`));
    });
  });

  describe("readDraft/writeDraft", () => {
    it("round-trips a valid draft through cast + JSON", () => {
      const draftPath = pathJoin(tempDir, `roundtrip${DRAFT_SUFFIX}`);
      const draft = cloneJSON(EMPTY_ROSTER_DRAFT);
      draft.stagedLock.title = "Test";

      writeDraft(draftPath, draft);
      const written = JSON.parse(readFileSync(draftPath, "utf-8"));
      expect(written.stagedLock.title).toBe("Test");

      const read = readDraft(draftPath);
      expect(read.stagedLock.title).toBe("Test");
    });

    it("throws when reading an invalid draft", () => {
      const draftPath = pathJoin(tempDir, `bad${DRAFT_SUFFIX}`);
      writeFileSync(draftPath, JSON.stringify({ not: "a draft" }));
      expect(() => readDraft(draftPath)).toThrow();
    });
  });
});
