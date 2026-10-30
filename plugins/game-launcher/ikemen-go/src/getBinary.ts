import { createWriteStream } from "node:fs";
import { mkdir, chmod } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import { PlatformTarget } from "@roster-lock/types";
import { isJSONObject, JSON_Object } from "@roster-lock/utils";
// @roster-lock/dl-archive-zip is a regular dependency here, not reached
// through match-agent's dynamic plugin-discovery (getPluginModulesOfType) -
// GameLauncherPlugin.getBinary's signature (see core/types/src/v1/runtime/
// game-launcher/index.ts) only ever receives dataDir/target, deliberately
// not a PluginManager, so a game-launcher plugin has to be self-contained
// about how it fetches its own binary, the same way this file already is
// about hitting GitHub's API directly in version.ts. Still worth the
// dependency over using its own unzipper directly: extractFiles turns a
// zip into a plain AsyncIterable<ArchiveFile>, and the same abstraction
// covers whichever other archive/compression plugin a future sibling
// asset might need (e.g. dl-archive-tar for a motif bundle shipped as a
// .tar.gz) without this file growing its own per-format logic.
import zip from "@roster-lock/dl-archive-zip";
import { fetchLatestStableRelease } from "./version";
import { resolveIkemenBinary } from "./binaryLocation";

// Ikemen's release assets are one zip per platform, filenames shaped
// "Ikemen_GO-<tag>-<suffix>.zip" (e.g. "Ikemen_GO-v1.0.0-linux.zip") -
// matched by suffix rather than the exact name, since the <tag> half
// varies release to release. No per-arch entries: same reasoning as
// EXECUTABLE_NAMES in binaryLocation.ts - one build covers both darwin
// arches, and there's nothing to pick for win32/linux's single arch either.
const RELEASE_ASSET_SUFFIX: Partial<Record<PlatformTarget["platform"], string>> = {
  win32: "windows",
  linux: "linux",
  darwin: "macos",
};

export function findReleaseAsset(
  release: JSON_Object, platform: PlatformTarget["platform"]
): { name: string, url: string } {
  const suffix = RELEASE_ASSET_SUFFIX[platform];
  if(!suffix){
    throw new Error(`ikemen-go: no official Ikemen GO release asset for platform "${platform}"`);
  }

  const assets = Array.isArray(release["assets"]) ? release["assets"] : [];
  const asset = assets.find(
    (a): a is JSON_Object => isJSONObject(a) && typeof a["name"] === "string" && a["name"].endsWith(`-${suffix}.zip`)
  );
  if(!asset || typeof asset["browser_download_url"] !== "string"){
    throw new Error(`ikemen-go: release ${String(release["tag_name"])} has no ${suffix} build.`);
  }
  return { name: asset["name"] as string, url: asset["browser_download_url"] };
}

async function downloadAndExtractZip(url: string, destinationFolder: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if(!response.ok || !response.body){
    throw new Error(`ikemen-go: failed to download ${url} (${response.status})`);
  }

  await mkdir(destinationFolder, { recursive: true });
  const body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>);
  for await (const file of zip.extractFiles(body)) {
    const destPath = join(destinationFolder, file.path);
    await mkdir(dirname(destPath), { recursive: true });
    await pipeline(Readable.from(file.contents), createWriteStream(destPath));
  }
}

// Downloads+extracts the official Ikemen GO release zip for `target` into
// its own subfolder of dataDir, named for the release tag - so a second
// call for a *different* release lands in a sibling folder instead of
// overwriting this one, and multiple versions can sit side by side (see
// GameLauncherPlugin.getBinary's own docs on why dataDir, not a single
// binaryLocation, is what this receives). A player never has to find/
// download/extract an Ikemen install themselves, which also means
// match-agent-client never needs a file dialog pointed at one for this
// plugin - native or on-screen - in the first place.
export async function getBinary(dataDir: string, target: PlatformTarget): Promise<{ binaryLocation: string }> {
  const release = await fetchLatestStableRelease();
  const asset = findReleaseAsset(release, target.platform);
  const tag = typeof release["tag_name"] === "string" ? release["tag_name"] : "unknown";
  const binaryLocation = join(dataDir, tag);

  // The official release zip already bundles a default motif/chars/stages,
  // so there's nothing else to layer on today - but this is deliberately a
  // list of one rather than a single hardcoded download, so a future
  // sibling asset (a specific tournament motif, say) is just another entry
  // landing in this same binaryLocation folder, not a reason to restructure
  // this function later.
  const assetsToExtract = [asset.url];
  for(const url of assetsToExtract){
    await downloadAndExtractZip(url, binaryLocation);
  }

  // The archive-extraction path above only carries file contents, not
  // POSIX permission bits - the engine binary needs its executable bit
  // set by hand, the same thing validateBinaryLocation.ts checks for.
  if(target.platform !== "win32"){
    await chmod(resolveIkemenBinary(binaryLocation, target), 0o755);
  }

  return { binaryLocation };
}
