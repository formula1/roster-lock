import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseGoBuildInfo, findInjectedVersions, versionFromLdflags } from "../src/goBuildInfo";
import { readLocalVersion } from "../src/version";

// Every buildinfo block and injected literal below is copied verbatim out of a
// real Ikemen GO download - the point of these fixtures is that they're what
// the shipped binaries actually contain, not what the parser wishes they did.
// The releases they came from are named on each one. They're assembled here
// rather than committed because the binaries they were taken from are ~14MB
// each, and the surrounding megabytes of machine code are irrelevant: the
// parser is a byte scan, so a file holding just these regions exercises it the
// same way a whole executable does.

// v1.0.0-rc.2 (Ikemen_GO_Linux). No -ldflags recorded despite being built with
// them, and the tree was dirty at build time - both true of the real release.
const RC2_BUILDINFO = [
  "go1.20.14 X:arenas",
  "build\t-buildmode=exe",
  "build\t-compiler=gc",
  "build\t-trimpath=true",
  "build\tCGO_ENABLED=1",
  "build\tGOARCH=amd64",
  "build\tGOEXPERIMENT=arenas",
  "build\tGOOS=linux",
  "build\tGOAMD64=v1",
  "build\tvcs=git",
  "build\tvcs.revision=c70199322c69106f8c658238c39aecbfdab54415",
  "build\tvcs.time=2026-08-01T19:18:52Z",
  "build\tvcs.modified=true",
].join("\n");
const RC2_REVISION = "c70199322c69106f8c658238c39aecbfdab54415";
// The two -X strings as they sit in rc.2's data section, NUL-padded, BuildTime
// immediately before Version. Reproduced byte-for-byte including the padding
// widths, since the padding is what makes them findable at all.
const nul = (count: number) => "\u0000".repeat(count);
const RC2_LITERALS = nul(8) + "2026.08.01" + nul(6) + "v1.0.0-rc.2" + nul(5);

// v0.99.0 (Ikemen_GO_Linux). The opposite case: ldflags recorded, no findable
// padded literal.
const V099_BUILDINFO = [
  "go1.20.10",
  "build\t-compiler=gc",
  "build\t-ldflags=\"-X 'main.Version=v0.99.0' -X 'main.BuildTime=2023-10-28'\"",
  "build\tCGO_ENABLED=1",
  "build\tvcs=git",
  "build\tvcs.revision=cb4143e5c968135e42a0641d60b5d1ecb47258e9",
  "build\tvcs.time=2023-10-28T08:28:02Z",
  "build\tvcs.modified=false",
].join("\n");

// A nightly build. Same shape as v0.99.0, but the version it names is a channel
// rather than a release.
const NIGHTLY_BUILDINFO = [
  "go1.20.14",
  "build\t-compiler=gc",
  "build\t-ldflags=\"-X 'main.Version=nightly' -X 'main.BuildTime=2025-02-16'\"",
  "build\tvcs=git",
  "build\tvcs.revision=233982f4835afcde5475cd55af4771f07002576a",
  "build\tvcs.time=2025-02-16T20:56:20Z",
  "build\tvcs.modified=false",
].join("\n");

// v0.98.2 (Ikemen_GO_Linux and Ikemen_GO.exe both report this, from the same
// zip - the commit is the platform-independent part). Predates Ikemen injecting
// a version at all: no ldflags, no literal, nothing but the commit.
const V098_BUILDINFO = [
  "go1.18rc1",
  "build\t-compiler=gc",
  "build\t-tags=al_cmpt",
  "build\tCGO_ENABLED=1",
  "build\tGOARCH=amd64",
  "build\tGOOS=linux",
  "build\tvcs=git",
  "build\tvcs.revision=38c795781c9e260a361c596500c993855077f553",
  "build\tvcs.time=2022-03-06T01:35:26Z",
  "build\tvcs.modified=false",
].join("\n");

// v0.98.2's Ikemen_GO_MacOS, the odd one out in that same zip: built with Go
// 1.15, which recorded module info but no build settings and no commit. This is
// all it has.
const V098_MACOS_MODULEINFO = [
  "cmd/compile go1.15.15",
  "path\tgithub.com/Windblade-GR01/Ikemen_GO/src",
  "mod\tgithub.com/Windblade-GR01/Ikemen_GO\t(devel)\t",
].join("\n");

let fixtureDir: string;

function writeFixture(name: string, ...regions: Array<string>): string {
  const path = join(fixtureDir, name);
  // Wrapped in filler so nothing depends on the regions sitting at offset 0.
  writeFileSync(path, Buffer.from("\x7fELF" + nul(3) + regions.join(nul(3)) + nul(1) + "trailing" + nul(1), "latin1"));
  return path;
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "ikemen-version-"));
});
afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("parseGoBuildInfo", () => {
  it("reads the commit out of a release that records no ldflags", () => {
    expect(parseGoBuildInfo(RC2_BUILDINFO)).toEqual({
      ldflags: undefined,
      vcsRevision: RC2_REVISION,
      vcsModified: true,
    });
  });

  it("reads ldflags when the toolchain recorded them", () => {
    const info = parseGoBuildInfo(V099_BUILDINFO);
    expect(info.ldflags).toBe("\"-X 'main.Version=v0.99.0' -X 'main.BuildTime=2023-10-28'\"");
    expect(info.vcsRevision).toBe("cb4143e5c968135e42a0641d60b5d1ecb47258e9");
    expect(info.vcsModified).toBe(false);
  });

  it("reports nothing for a file that isn't a Go binary", () => {
    expect(parseGoBuildInfo("just some bytes")).toEqual({
      ldflags: undefined,
      vcsRevision: undefined,
      vcsModified: undefined,
    });
  });
});

describe("versionFromLdflags", () => {
  it("unwraps the quoting build.sh uses", () => {
    expect(versionFromLdflags("\"-X 'main.Version=v0.99.0' -X 'main.BuildTime=2023-10-28'\"")).toBe("v0.99.0");
  });

  it("accepts a bare value", () => {
    expect(versionFromLdflags("-s -w -X main.Version=v1.2.3 -X main.BuildTime=2026-01-01")).toBe("v1.2.3");
  });

  it("ignores ldflags that set something else", () => {
    expect(versionFromLdflags("-s -w -X 'main.BuildTime=2026-01-01'")).toBeUndefined();
  });
});

describe("findInjectedVersions", () => {
  it("finds the padded literal and leaves out its BuildTime neighbour", () => {
    // The date is version-shaped under the same pattern, which is the whole
    // reason dates are filtered - build.sh's default BuildTime is %Y.%m.%d.
    expect(findInjectedVersions(RC2_LITERALS)).toEqual(["v1.0.0-rc.2"]);
  });

  it("finds nothing in a binary that never had a version injected", () => {
    expect(findInjectedVersions(V098_BUILDINFO)).toEqual([]);
  });

  it("returns every candidate rather than choosing between them", () => {
    expect(findInjectedVersions(nul(1) + "v1.0.0" + nul(3) + "2.3.4" + nul(1))).toEqual(["v1.0.0", "2.3.4"]);
  });
});

describe("readLocalVersion", () => {
  it("falls back to the padded literal when ldflags aren't recorded", async () => {
    const path = writeFixture("rc2", RC2_BUILDINFO, RC2_LITERALS);
    expect(await readLocalVersion(path)).toEqual({ title: "v1.0.0-rc.2", id: RC2_REVISION });
  });

  it("prefers ldflags when they're there", async () => {
    const path = writeFixture("v099", V099_BUILDINFO);
    expect(await readLocalVersion(path)).toEqual({
      title: "v0.99.0",
      id: "cb4143e5c968135e42a0641d60b5d1ecb47258e9",
    });
  });

  it("reports the channel name for a nightly", async () => {
    const path = writeFixture("nightly", NIGHTLY_BUILDINFO);
    expect(await readLocalVersion(path)).toEqual({
      title: "nightly",
      // Two nightlies are only told apart by this - every one of them is
      // titled "nightly".
      id: "233982f4835afcde5475cd55af4771f07002576a",
    });
  });

  it("still identifies a build that carries no version string", async () => {
    const path = writeFixture("v098", V098_BUILDINFO);
    expect(await readLocalVersion(path)).toEqual({
      title: "unknown build (38c7957)",
      id: "38c795781c9e260a361c596500c993855077f553",
    });
  });

  it("refuses to guess when the scan is ambiguous", async () => {
    const path = writeFixture("ambiguous", RC2_BUILDINFO, nul(1) + "v1.0.0-rc.2" + nul(3) + "v9.9.9" + nul(1));
    expect(await readLocalVersion(path)).toEqual({
      title: `unknown build (${RC2_REVISION.slice(0, 7)})`,
      id: RC2_REVISION,
    });
  });

  it("throws for a real Ikemen binary built before Go stamped commits", async () => {
    const path = writeFixture("v098-macos", V098_MACOS_MODULEINFO);
    await expect(readLocalVersion(path)).rejects.toThrow(/predate Go stamping the commit/);
  });

  it("throws for a file with no build info at all", async () => {
    const path = join(fixtureDir, "not-ikemen");
    writeFileSync(path, "#!/bin/sh\necho hello\n");
    await expect(readLocalVersion(path)).rejects.toThrow(/carries no Go build info/);
  });

  it("throws for a binary that isn't there", async () => {
    await expect(readLocalVersion(join(fixtureDir, "missing"))).rejects.toThrow(/couldn't read the Ikemen binary/);
  });
});

// The real thing, when there's an install to point at. Opt-in because CI has no
// Ikemen: IKEMEN_GO_BINARY=/path/to/Ikemen_GO_Linux pnpm test
const realBinary = process.env["IKEMEN_GO_BINARY"];
describe.skipIf(realBinary === undefined)("readLocalVersion against a real install", () => {
  it("reads a version and a commit out of it", async () => {
    const version = await readLocalVersion(realBinary as string);
    expect(version.id).toMatch(/^[0-9a-f]{40}$/);
    expect(version.title).not.toBe("");
  });
});

describe("fetchSupportedVersion", () => {
  // The module caches responses, so each test gets its own copy of it rather
  // than inheriting whatever the previous one primed.
  async function withFetch(handler: (url: string) => unknown){
    vi.resetModules();
    const calls: Array<string> = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, url, json: async () => handler(url) } as Response;
    });
    const { fetchSupportedVersion } = await import("../src/version");
    return { fetchSupportedVersion, calls };
  }

  const stableRelease = {
    tag_name: "v1.0.0-rc.2",
    target_commitish: "c70199322c69106f8c658238c39aecbfdab54415",
  };

  it("returns the latest release's tag and commit", async () => {
    const { fetchSupportedVersion, calls } = await withFetch(() => stableRelease);
    const path = writeFixture("supported-stable", V099_BUILDINFO);

    expect(await fetchSupportedVersion(path)).toEqual({
      title: "v1.0.0-rc.2",
      id: "c70199322c69106f8c658238c39aecbfdab54415",
    });
    expect(calls).toEqual(["https://api.github.com/repos/ikemen-engine/Ikemen-GO/releases/latest"]);
  });

  it("asks for the nightly release when the local build is one", async () => {
    const { fetchSupportedVersion, calls } = await withFetch(() => ({
      tag_name: "nightly",
      target_commitish: "149402fa8b50a64e9af8316772e0cd266025133a",
    }));
    const path = writeFixture("supported-nightly", NIGHTLY_BUILDINFO);

    expect(await fetchSupportedVersion(path)).toEqual({
      title: "nightly",
      id: "149402fa8b50a64e9af8316772e0cd266025133a",
    });
    expect(calls).toEqual(["https://api.github.com/repos/ikemen-engine/Ikemen-GO/releases/tags/nightly"]);
  });

  it("resolves the tag when target_commitish is a branch name", async () => {
    // v0.99.0's really is "master" - GitHub only stores a commit there for
    // releases cut from a specific sha.
    const { fetchSupportedVersion, calls } = await withFetch((url) => (
      url.includes("/releases/")
        ? { tag_name: "v0.99.0", target_commitish: "master" }
        : { object: { type: "commit", sha: "cb4143e5c968135e42a0641d60b5d1ecb47258e9" } }
    ));
    const path = writeFixture("supported-branch", V099_BUILDINFO);

    expect(await fetchSupportedVersion(path)).toEqual({
      title: "v0.99.0",
      id: "cb4143e5c968135e42a0641d60b5d1ecb47258e9",
    });
    expect(calls[1]).toBe("https://api.github.com/repos/ikemen-engine/Ikemen-GO/git/ref/tags/v0.99.0");
  });

  it("dereferences an annotated tag to the commit under it", async () => {
    const { fetchSupportedVersion } = await withFetch((url) => {
      if(url.includes("/releases/")) return { tag_name: "v9.9.9", target_commitish: "develop" };
      if(url.includes("/git/ref/")) return { object: { type: "tag", sha: "0".repeat(40) } };
      return { object: { type: "commit", sha: "a".repeat(40) } };
    });
    const path = writeFixture("supported-annotated", V099_BUILDINFO);

    // The tag object's own sha is not a commit any binary could ever report,
    // so returning it would guarantee a false "you're behind".
    expect(await fetchSupportedVersion(path)).toEqual({ title: "v9.9.9", id: "a".repeat(40) });
  });

  it("still answers when there's no readable binary to pick a channel from", async () => {
    const { fetchSupportedVersion, calls } = await withFetch(() => stableRelease);

    expect(await fetchSupportedVersion(join(fixtureDir, "missing"))).toEqual({
      title: "v1.0.0-rc.2",
      id: "c70199322c69106f8c658238c39aecbfdab54415",
    });
    expect(calls).toEqual(["https://api.github.com/repos/ikemen-engine/Ikemen-GO/releases/latest"]);
  });

  it("caches, so a settings screen can't burn the rate limit", async () => {
    const { fetchSupportedVersion, calls } = await withFetch(() => stableRelease);
    const path = writeFixture("supported-cached", V099_BUILDINFO);

    await fetchSupportedVersion(path);
    await fetchSupportedVersion(path);
    expect(calls).toHaveLength(1);
  });

  it("says so plainly when GitHub rate-limits the check", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", async (url: string) => ({
      ok: false, status: 403, url, json: async () => ({ message: "API rate limit exceeded" }),
    } as Response));
    const { fetchSupportedVersion } = await import("../src/version");
    const path = writeFixture("supported-limited", V099_BUILDINFO);

    await expect(fetchSupportedVersion(path)).rejects.toThrow(/rate-limited/);
  });
});
