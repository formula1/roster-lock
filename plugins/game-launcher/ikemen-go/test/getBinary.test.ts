import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { crc32 } from "node:zlib";
import type { PlatformTarget } from "@roster-lock/types";
import type { JSON_Object } from "@roster-lock/utils";
import { findReleaseAsset } from "../src/getBinary";
import { resolveIkemenBinary } from "../src/binaryLocation";

const stableRelease: JSON_Object = {
  tag_name: "v1.0.0",
  assets: [
    { name: "Ikemen_GO-v1.0.0-android.zip", browser_download_url: "https://example.test/android.zip" },
    { name: "Ikemen_GO-v1.0.0-linux.zip", browser_download_url: "https://example.test/linux.zip" },
    { name: "Ikemen_GO-v1.0.0-macos.zip", browser_download_url: "https://example.test/macos.zip" },
    { name: "Ikemen_GO-v1.0.0-windows.zip", browser_download_url: "https://example.test/windows.zip" },
    { name: "SHA256SUMS.txt", browser_download_url: "https://example.test/sha.txt" },
  ],
};

describe("findReleaseAsset", () => {
  it("matches the linux asset by its -linux.zip suffix", () => {
    expect(findReleaseAsset(stableRelease, "linux")).toEqual({
      name: "Ikemen_GO-v1.0.0-linux.zip", url: "https://example.test/linux.zip",
    });
  });

  it("matches windows to the -windows.zip asset", () => {
    expect(findReleaseAsset(stableRelease, "win32")).toEqual({
      name: "Ikemen_GO-v1.0.0-windows.zip", url: "https://example.test/windows.zip",
    });
  });

  it("matches darwin to the single -macos.zip asset regardless of arch", () => {
    expect(findReleaseAsset(stableRelease, "darwin")).toEqual({
      name: "Ikemen_GO-v1.0.0-macos.zip", url: "https://example.test/macos.zip",
    });
  });

  it("throws for a platform Ikemen GO doesn't publish a build for", () => {
    expect(() => findReleaseAsset(stableRelease, "aix")).toThrow(/no official Ikemen GO release asset/);
  });

  it("throws when the release has no matching asset at all", () => {
    const bareRelease: JSON_Object = { tag_name: "v9.9.9", assets: [] };
    expect(() => findReleaseAsset(bareRelease, "linux")).toThrow(/has no linux build/);
  });

  it("throws when the release has no assets field at all", () => {
    expect(() => findReleaseAsset({ tag_name: "v9.9.9" }, "linux")).toThrow(/has no linux build/);
  });
});

// A hand-built "stored" (uncompressed) zip - no third-party zip-writing
// dependency exists in this repo, but the stored method needs nothing
// beyond a correct CRC32 (node:zlib has had one built in since Node 22),
// so it's simpler to construct the handful of bytes directly than to pull
// one in just for a test fixture.
function buildStoredZip(files: Array<{ path: string, contents: string }>): Buffer {
  const localParts: Array<Buffer> = [];
  const centralParts: Array<Buffer> = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.path, "utf8");
    const dataBuf = Buffer.from(file.contents, "utf8");
    const crc = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression method - stored
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18); // compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localSection = Buffer.concat(localParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD
  eocd.writeUInt16LE(files.length, 8); // entries this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirectory.length, 12); // size of CD
  eocd.writeUInt32LE(localSection.length, 16); // offset of CD
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localSection, centralDirectory, eocd]);
}

describe("getBinary", () => {
  let fixtureDir: string;
  const TARGET: PlatformTarget = { platform: "linux", arch: "x64" };

  function zipFetchStub(release: JSON_Object, assetUrl: string, zipBuffer: Buffer) {
    return async (url: string) => {
      if (url === "https://api.github.com/repos/ikemen-engine/Ikemen-GO/releases/latest") {
        return { ok: true, status: 200, json: async () => release } as Response;
      }
      if (url === assetUrl) {
        const { Readable } = await import("node:stream");
        return { ok: true, status: 200, body: Readable.toWeb(Readable.from(zipBuffer)) } as unknown as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
  }

  beforeEach(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "ikemen-get-binary-"));
  });
  afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("downloads and extracts the right platform's release into a tag-named subfolder of dataDir", async () => {
    const zipBuffer = buildStoredZip([
      { path: "Ikemen_GO_Linux", contents: "fake engine binary" },
      { path: "data/config.txt", contents: "nested file" },
    ]);
    vi.stubGlobal("fetch", zipFetchStub(stableRelease, "https://example.test/linux.zip", zipBuffer));

    const { getBinary } = await import("../src/getBinary");
    const { binaryLocation } = await getBinary(fixtureDir, TARGET);

    expect(binaryLocation).toBe(join(fixtureDir, "v1.0.0"));
    expect(readFileSync(resolveIkemenBinary(binaryLocation, TARGET), "utf8")).toBe("fake engine binary");
    expect(readFileSync(join(binaryLocation, "data/config.txt"), "utf8")).toBe("nested file");
    // chmod +x - validateBinaryLocation.ts checks for this on POSIX.
    expect(statSync(resolveIkemenBinary(binaryLocation, TARGET)).mode & 0o111).toBeTruthy();
  });

  it("lands a different release in a sibling folder, leaving an earlier download untouched", async () => {
    const v1Zip = buildStoredZip([{ path: "Ikemen_GO_Linux", contents: "v1 binary" }]);
    vi.stubGlobal("fetch", zipFetchStub(stableRelease, "https://example.test/linux.zip", v1Zip));
    const first = await (await import("../src/getBinary")).getBinary(fixtureDir, TARGET);

    // version.ts caches a release lookup for 5 minutes by URL
    // (getJSON's own module-level cache) - both calls hit the same
    // "releases/latest" URL, so without resetting modules the second call
    // would silently see the first release again instead of this new stub.
    vi.resetModules();
    const otherRelease: JSON_Object = {
      tag_name: "v2.0.0",
      assets: [{ name: "Ikemen_GO-v2.0.0-linux.zip", browser_download_url: "https://example.test/v2-linux.zip" }],
    };
    const v2Zip = buildStoredZip([{ path: "Ikemen_GO_Linux", contents: "v2 binary" }]);
    vi.stubGlobal("fetch", zipFetchStub(otherRelease, "https://example.test/v2-linux.zip", v2Zip));
    const second = await (await import("../src/getBinary")).getBinary(fixtureDir, TARGET);

    expect(first.binaryLocation).not.toBe(second.binaryLocation);
    expect(readFileSync(resolveIkemenBinary(first.binaryLocation, TARGET), "utf8")).toBe("v1 binary");
    expect(readFileSync(resolveIkemenBinary(second.binaryLocation, TARGET), "utf8")).toBe("v2 binary");
  });

  it("throws with the response status when the download itself fails", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("api.github.com")) return { ok: true, status: 200, json: async () => stableRelease } as Response;
      return { ok: false, status: 404 } as Response;
    });

    const { getBinary } = await import("../src/getBinary");
    await expect(getBinary(fixtureDir, TARGET)).rejects.toThrow(/404/);
  });
});
