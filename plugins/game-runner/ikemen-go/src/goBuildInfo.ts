import { readFile } from "node:fs/promises";

// Ikemen GO has no `-version` flag - `processCommandLine` (src/main.go) has no
// case for one, and its `-h` help text lists every option it does accept. Worse,
// an unrecognised flag isn't rejected: it just lands in `sys.cmdFlags` and the
// engine boots anyway, so probing for a version flag would start a match. The
// engine's own `Version` is a link-time variable (`var Version = "development"`,
// overridden with `-X main.Version=...` by build/build.sh), and it's only ever
// surfaced from a *running* engine - the panic handler and the Lua `version()`
// binding.
//
// So the version is read out of the executable file instead. Ikemen is a Go
// program, and every Go binary since 1.18 carries the build-info blob that
// `go version -m` prints. The parts worth having are stored as plain
// tab-separated text, which means a byte scan gets at them without an
// ELF/PE/Mach-O parse or a Go toolchain - the same code works on
// Ikemen_GO_Linux, Ikemen_GO.exe and Ikemen_GO_MacOS.

export type GoBuildInfo = {
  // The `-ldflags` build setting, when the toolchain recorded one. Not always
  // present even though Ikemen always builds with ldflags: the v0.99.0 and
  // nightly binaries record it, the v1.0.0-rc.2 release doesn't.
  ldflags: string | undefined,
  // The commit the binary was built from. Recorded for anything built inside a
  // git checkout, which covers every official release including v0.98.2, whose
  // build predates Ikemen injecting a version string at all.
  vcsRevision: string | undefined,
  // Whether the checkout had uncommitted changes at build time. True even for
  // some official releases (v1.0.0-rc.2), so this can't be treated as "somebody
  // built this themselves".
  vcsModified: boolean | undefined,
};

const LDFLAGS = /^build\t-ldflags=(.*)$/m;
const VCS_REVISION = /^build\tvcs\.revision=([0-9a-f]{7,64})$/m;
const VCS_MODIFIED = /^build\tvcs\.modified=(true|false)$/m;

// A `-X main.Version=...` string is written into its own NUL-padded slot in the
// data section rather than being packed into the one big run-together blob that
// ordinary Go string constants share, so it can be found by its delimiters.
const PADDED_VERSION = /\0(v?\d+\.\d+\.\d+(?:[-.+][0-9A-Za-z.\-]*)?)\0/g;
// `-X main.BuildTime=...` lands in the neighbouring slot and is version-shaped
// under the pattern above - build/build.sh defaults it to `date +%Y.%m.%d`, and
// CI passes an ISO date. Filtered out rather than mistaken for the version.
const DATE_LIKE = /^\d{4}[-.]\d{2}[-.]\d{2}$/;

// latin1 rather than utf8: it maps every byte to a distinct code unit, so NUL
// bytes and the rest of the binary noise survive intact. utf8 would mangle
// anything non-ASCII into replacement characters and break the NUL delimiters
// findInjectedVersions relies on.
export async function readBinaryText(binaryLocation: string): Promise<string> {
  try {
    return (await readFile(binaryLocation)).toString("latin1");
  } catch(e){
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`ikemen-go: couldn't read the Ikemen binary at "${binaryLocation}" - ${reason}`);
  }
}

export function parseGoBuildInfo(binaryText: string): GoBuildInfo {
  const modified = binaryText.match(VCS_MODIFIED)?.[1];
  return {
    ldflags: binaryText.match(LDFLAGS)?.[1],
    vcsRevision: binaryText.match(VCS_REVISION)?.[1],
    vcsModified: modified === undefined ? undefined : modified === "true",
  };
}

// Every distinct version-shaped linker-injected literal in the binary. Returns
// all of them rather than picking one, because "exactly one candidate" is the
// only case where this is trustworthy enough to report as a version - see
// localVersionTitle.
export function findInjectedVersions(binaryText: string): Array<string> {
  const found = new Set<string>();
  for(const match of binaryText.matchAll(PADDED_VERSION)){
    if(DATE_LIKE.test(match[1])) continue;
    found.add(match[1]);
  }
  return [...found];
}

// Pulls main.Version out of a recorded -ldflags setting. Go records the flag
// text as the build script wrote it, quotes and all, and build/build.sh quotes
// the whole assignment rather than just the value: the recorded text reads
// `-X 'main.Version=v0.99.0'`. So the value runs to the next quote or space,
// which also covers a bare `-X main.Version=v0.99.0`.
export function versionFromLdflags(ldflags: string): string | undefined {
  return ldflags.match(/main\.Version=([^'"\s]+)/)?.[1];
}
