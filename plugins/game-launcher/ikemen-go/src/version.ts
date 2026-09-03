import { GameLauncherPlugin, PlatformTarget } from "@roster-lock/types";
import { handleFetch, isJSONObject, JSON_Object } from "@roster-lock/utils";
import {
  readBinaryText, parseGoBuildInfo, findInjectedVersions, versionFromLdflags, GoBuildInfo
} from "./goBuildInfo";
import { resolveIkemenBinary } from "./binaryLocation";
import { IkemenGameConfig } from "./startGame/buildArgs";

// Tied to the plugin type rather than redeclared, so the two can't drift.
export type IkemenVersion = Awaited<ReturnType<GameLauncherPlugin<IkemenGameConfig>["getLocalVersion"]>>;

// The two halves answer different questions, and both are needed:
//
// - `id` is the commit the binary was built from. It's an exact-equality key
//   for "is everyone in this room on the same build", and it's the only field
//   that can do that job, because the room mixes platforms: a Windows player
//   and a Linux player have completely different executables, so hashing the
//   file would report a mismatch between two people running the same release.
//   The recorded revision doesn't vary by platform - the v0.98.2 zip's
//   Ikemen_GO.exe and Ikemen_GO_Linux both report 38c7957 despite being
//   entirely different executables.
//
// - `title` is what the build calls itself, matching the release tag it came
//   from. That's what the "you're behind" notice compares and displays, since
//   `id` can't be derived from a release reliably (see fetchSupportedVersion).
//
// Deliberately not the same check: a room full of people on an older build is
// fine and stays playable - some rosters want an older engine, and a new
// release can break things - so version equality gates the room while being
// behind is only a notification.

const NIGHTLY = "nightly";
const REPO_API = "https://api.github.com/repos/ikemen-engine/Ikemen-GO";
const SHA = /^[0-9a-f]{40}$/;

export async function readLocalVersion(binaryLocation: string, target: PlatformTarget): Promise<IkemenVersion> {
  const resolvedPath = resolveIkemenBinary(binaryLocation, target);
  const binaryText = await readBinaryText(resolvedPath);
  const buildInfo = parseGoBuildInfo(binaryText);

  if(buildInfo.vcsRevision === undefined){
    // Reachable for a real Ikemen install, though only a very old one: the
    // v0.98.2 zip's Ikemen_GO_MacOS was built with Go 1.15, before Go recorded
    // build settings or stamped the commit at all, so it carries nothing that
    // identifies it. Its Linux and Windows siblings in the same zip were built
    // with Go 1.18rc1 and are fine. Nothing this old can host a roster-lock
    // match anyway - see the engine requirements in examples/mugen.
    throw new Error(
      `ikemen-go: "${resolvedPath}" carries no Go build info - it isn't an Ikemen GO binary, or it's an ` +
      "Ikemen build old enough to predate Go stamping the commit into it (Go 1.18, so anything before " +
      "v0.99.0). Without a commit there's nothing that identifies this build across platforms, so it " +
      "can't be version-matched against other players."
    );
  }

  return {
    title: localVersionTitle(binaryText, buildInfo) ?? `unknown build (${buildInfo.vcsRevision.slice(0, 7)})`,
    id: buildInfo.vcsRevision,
  };
}

// Neither source covers every build on its own, so both are tried: v0.99.0 and
// the nightlies record their ldflags, v1.0.0-rc.2 doesn't but leaves the padded
// literal findable, and v0.98.2 predates Ikemen injecting a version at all and
// has neither.
function localVersionTitle(binaryText: string, buildInfo: GoBuildInfo): string | undefined {
  if(buildInfo.ldflags !== undefined){
    const injected = versionFromLdflags(buildInfo.ldflags);
    if(injected !== undefined) return injected;
  }
  const candidates = findInjectedVersions(binaryText);
  // Only trustworthy when the scan is unambiguous. Anything else is a guess,
  // and a wrong title here doesn't just display wrong - it's what the
  // behind-the-latest-release check compares, so it would quietly tell someone
  // on the current release to go download it again.
  if(candidates.length === 1) return candidates[0];
  return undefined;
}

// GitHub's release object is enough on its own: no download, one request. For
// v1.0.0-rc.2 it reports tag_name "v1.0.0-rc.2" - byte-identical to the literal
// baked into the released binary - and target_commitish c7019932..., the same
// commit that binary records.
//
// binaryLocation is read to pick the channel. The nightly release re-points
// constantly and calls itself "nightly" forever, so a nightly user compared
// against the stable channel would be permanently "behind" something they
// didn't ask for.
//
// No target parameter - GameLauncherPlugin.getSupportedVersion never takes
// one (see docs/v2/binary-location.md, the answer doesn't vary by
// platform), but picking a channel still needs *some* local binary to sniff,
// so this reads whatever's bundled for the current host. If nothing's
// bundled for it (or nothing at all yet), readLocalVersion's rejection
// below is swallowed and the stable channel is assumed - same fallback as
// "no binary configured at all".
export async function fetchSupportedVersion(binaryLocation: string): Promise<IkemenVersion> {
  const currentHost: PlatformTarget = { platform: process.platform, arch: process.arch };
  const local = await readLocalVersion(binaryLocation, currentHost).catch(() => undefined);
  const release = local?.title === NIGHTLY
    ? await getJSON(`${REPO_API}/releases/tags/${NIGHTLY}`)
    // Ikemen marks its release candidates prerelease:false, so /latest resolves
    // to v1.0.0-rc.2 rather than skipping back to v0.99.0.
    : await getJSON(`${REPO_API}/releases/latest`);

  const tag = release["tag_name"];
  if(typeof tag !== "string"){
    throw new Error("ikemen-go: GitHub's latest-release response had no tag_name - the API shape has changed.");
  }

  return { title: tag, id: await releaseCommit(release, tag) };
}

// target_commitish is a commit for current releases but a branch name on older
// ones (v0.99.0's is "master"), so it's used when it's usable and the tag is
// resolved when it isn't.
//
// Worth knowing before trusting this too far: a tag's commit is not guaranteed
// to be the commit the release *binary* was built from. The official v0.98.2
// zip records 38c7957 while the v0.98.2 tag points at 69b3936 - that release
// was built off-tag. So this is the release's identity, and comparing it
// against a local id is a weaker signal than comparing titles.
async function releaseCommit(release: JSON_Object, tag: string): Promise<string> {
  const target = release["target_commitish"];
  if(typeof target === "string" && SHA.test(target)) return target;

  const ref = await getJSON(`${REPO_API}/git/ref/tags/${encodeURIComponent(tag)}`);
  const object = ref["object"];
  if(!isJSONObject(object) || typeof object["sha"] !== "string"){
    throw new Error(`ikemen-go: couldn't resolve the commit behind Ikemen GO release ${tag}.`);
  }
  // Ikemen's tags are lightweight, so this is normally the commit already. An
  // annotated tag would name a tag object instead, which has to be dereferenced
  // to avoid returning a sha that no binary could ever report.
  if(object["type"] !== "tag") return object["sha"];

  const tagObject = await getJSON(`${REPO_API}/git/tags/${object["sha"]}`);
  const commit = tagObject["object"];
  if(!isJSONObject(commit) || typeof commit["sha"] !== "string"){
    throw new Error(`ikemen-go: couldn't dereference the annotated tag for Ikemen GO release ${tag}.`);
  }
  return commit["sha"];
}

// Unauthenticated GitHub allows 60 requests an hour per IP, and nothing stops a
// settings screen from asking for the supported version on every render. A
// short cache keeps that from burning the budget without holding a stale answer
// long enough to matter - a release nobody has published yet isn't urgent.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number, body: JSON_Object }>();

async function getJSON(url: string): Promise<JSON_Object> {
  const cached = cache.get(url);
  if(cached !== undefined && Date.now() - cached.at < CACHE_MS) return cached.body;

  const body = await handleFetch<JSON_Object>(fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub rejects API requests that don't identify themselves.
      "User-Agent": "roster-lock-game-launcher-ikemen-go",
    },
    signal: AbortSignal.timeout(10_000),
  })).catch((e) => {
    const status = (e as { statusCode?: number }).statusCode;
    if(status === 403 || status === 429){
      throw new Error(
        "ikemen-go: GitHub rate-limited the check for the latest Ikemen GO release. Try again later."
      );
    }
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`ikemen-go: couldn't reach GitHub to check the latest Ikemen GO release - ${reason}`);
  });

  if(!isJSONObject(body)){
    throw new Error(`ikemen-go: expected a JSON object from ${url}.`);
  }
  cache.set(url, { at: Date.now(), body });
  return body;
}
