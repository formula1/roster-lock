
import { RosterLockV1Config } from "../../lock";
import { RosterLockV1SyncDLResult } from "../../request";
import { RoomMachine } from "../../relay";
import { Sha256 } from "../../shared";
import type { AnySchema, JSONSchemaType } from "ajv";

export type ConnectionMode = "direct-tcp" | "room" | "internal";

// Mirrors NodeJS.Platform/NodeJS.Architecture (node_modules/@types/node's
// process.d.ts) rather than importing them - this package deliberately
// carries no @types/node dependency since it's also consumed by browser
// code (see package.json's empty "types" compiler option). A caller with
// @types/node can still pass process.platform/process.arch straight
// through unchanged.
export type PlatformName = (
  "aix" | "android" | "darwin" | "freebsd" | "haiku" | "linux" |
  "openbsd" | "sunos" | "win32" | "cygwin" | "netbsd"
);
export type ArchName = (
  "arm" | "arm64" | "ia32" | "loong64" | "mips" | "mipsel" |
  "ppc64" | "riscv64" | "s390x" | "x64"
);

// What a caller resolves a multi-platform binaryLocation bundle against -
// see docs/v2/binary-location.md.
export type PlatformTarget = {
  platform: PlatformName,
  arch: ArchName,
};

// The two variants shared as-is between ConnectionSetup and ConnectionConfig
// below - neither needs anything resolved before a plugin can use it.
type RoomOrInternalConnection = (
  // The room's actual connection work happens entirely on the game side -
  // `version` just tells it which of its own supported approaches to use
  // (see GameRunnerPlugin.supportedRoomVersions), `url` is where it does
  // that work. No separate protocol field: whatever `version` names already
  // implies its protocol.
  | { type: "room", version: string, url: string }
  // The game has its own online connection story - roster-lock hands it a
  // selection and gets out of the way.
  | { type: "internal" }
);

// What a matchmaker/caller hands to match-agent's start-game route - a
// direct-tcp room's host address isn't knowable upfront by whoever builds
// this (it may be behind NAT, or simply not yet bound its listen socket), so
// both variants instead carry the address of a small rendezvous coordinator
// (see plugins/game-runner/shared/direct-ip-coordinator and
// docs/v2/ikemen-go/game-coordinator.md) rather than a resolved address.
// match-agent's GameRunner.startGame is what turns this into a
// ConnectionConfig below before a plugin ever sees it - no plugin talks to a
// coordinator itself.
export type ConnectionSetup = (
  | { type: "direct-tcp", party: "host", port: number, coordinator: { host: string, port: number } }
  | { type: "direct-tcp", party: "client", port: number, coordinator: { host: string, port: number } }
  | RoomOrInternalConnection
);

// What a GameRunnerPlugin's startGame actually receives - direct-tcp is
// already resolved by this point (see ConnectionSetup above), so a plugin
// only ever deals with an address to dial, never a coordinator of its own.
export type ConnectionConfig = (
  | { type: "direct-tcp", party: "host", port: number }
  // hostIp is what a coordinator (or whatever else resolved this) reported
  // - the same value startGame would otherwise have had to go discover
  // itself.
  | { type: "direct-tcp", party: "client", port: number, hostIp: string }
  | RoomOrInternalConnection
);

export type GameProcessHandle = {
  // Fires when the process this plugin is directly watching exits - not
  // necessarily the same as "the game is over". Some games are started via
  // an intermediary (a platform launcher, a wrapper script) that spawns the
  // real game and exits 0 once it's handed off; for those, onExit only means
  // the hand-off succeeded, not that play has ended - the plugin may have no
  // handle to the actual game process at all. A plugin watching the real
  // game process directly (e.g. spawning the engine binary itself, like
  // ikemen-go does) can report both meaningfully; one that can't should say
  // so in its publicInfo rather than let callers assume more than it can
  // promise.
  exited: false | { code: number },
  onExit: (cb: (code: number | null) => void) => void,
  onCrash: (cb: (error: Error) => void) => void,
  // Best-effort - may not actually be able to stop the game if it's already
  // handed off to a process this plugin no longer has a handle to.
  stop: () => Promise<void>,
};

export type StartGameArgs<T> = {
  // Handed to the game coordinator on the relay room's success webhook -
  // lets a plugin correlate itself back to that room if it ever needs to.
  relayRoomId: string,
  currentMachine: {
    machineId: string,
    publicKey: string,
    // A temp file - written with restrictive/owner-only permissions before
    // startGame is invoked, deleted once the returned GameProcessHandle
    // reports exit/crash - containing this machine's private key, for
    // plugins that need to sign messages to identify the user to a game
    // coordinator. Most games (Ikemen included) have no identity concept in
    // their own netcode and never touch this.
    //
    // Handled as a file the framework manages (see
    // @roster-lock/plugin-runtime's GameRunner) rather than handing plugins
    // the raw key directly, so a plugin is safe by default even if it does
    // something careless with it - e.g. forwarding it into the spawned
    // process's argv/env would otherwise leak to other users via `ps`/`/proc`
    // on a shared machine (see docs/v2/test-environments.md's Internet Cafe
    // / Arcade targets). A plugin that does need to hand the game itself an
    // identity can still pass this same file path through unchanged.
    privateKeyFile: string,
  },
  allMachines: Array<RoomMachine>,
  selectionResult: RosterLockV1SyncDLResult,
  rosterConfig: RosterLockV1Config,
  // Lets a plugin without direct filesystem access to the downloaded pieces
  // (selectionResult.downloadResults[...].folder assumes it's running on the
  // same machine as match-agent) pull file contents over HTTP instead.
  matchAgent: { port: number, authCode: string },
  // Room-shared settings every participant agreed to at room-creation time
  // (e.g. team mode, round time). Validated against gameConfigSchema.
  gameConfig: T,
};

export type GameRunnerPlugin<T> = {
  name: string,
  publicInfo: {
    title: string,
    description: string,
  },
  // Which ConnectionConfig["type"] values this plugin actually knows how to
  // consume in startGame - not just "would make sense for", since a mode
  // like "room" typically depends on unbuilt bridge infrastructure. Only
  // declare a mode once startGame genuinely handles it.
  supportedConnectionModes: Array<ConnectionMode>,
  // Which ConnectionConfig["room"]["version"] values this plugin supports.
  // Only meaningful if "room" is in supportedConnectionModes.
  supportedRoomVersions?: Array<string>,
  // Identifies which RosterLockEngineConfig["pieceDefinitions"] shape this
  // plugin was built against - a hash of that shape alone (not engine.name,
  // engine.version, or engine.officialSelections, which are roster-author
  // choices, not part of what the plugin structurally needs). Before a room
  // can be created, this is compared against the same hash computed over the
  // roster config's own engine.pieceDefinitions ("Engine Sha" in
  // docs/v2/ikemen-go/general-plan.md) - a mismatch means the plugin's
  // assumptions about piece layout (e.g. ikemen-go's defName path variable)
  // don't hold for that roster.
  engineSha: Sha256,
  // JSON Schema for StartGameArgs["gameConfig"]. Set even when empty ({}).
  gameConfigSchema: JSONSchemaType<T>,
  // JSON Schema for this plugin's other per-machine settings (e.g. a
  // preferred direct-tcp port). Excludes binaryLocation, which every Game
  // Runner has by definition - see the functions below. Set even when empty.
  localConfigSchema: AnySchema,
  // Every platform/arch this plugin knows how to run on at all, independent
  // of whether any particular binaryLocation currently has a binary for one
  // of them - see docs/v2/binary-location.md. Lets a browsing/install UI
  // warn "not supported on macOS" before the user has configured a
  // binaryLocation to check against.
  supportedPlatforms: Array<PlatformTarget>,

  // binaryLocation is resolved locally (e.g. from match-agent's own config)
  // and is what "disabled until configured" is about - every function below
  // needs it pointed at something real to do anything useful. As of
  // docs/v2/binary-location.md it's the root of a multi-platform bundle, not
  // a path to one executable - each function below that needs a concrete
  // binary resolves `target` against it itself; the layout convention for
  // doing that is the plugin's own to define.
  //
  // `target` is required everywhere a concrete binary has to be resolved,
  // rather than any function defaulting to "the current host" implicitly -
  // see docs/v2/binary-location.md's "Platform targeting per function" for
  // why (getSupportedVersion is the one exception, since it's a
  // platform-agnostic upstream-metadata query).
  getLocalVersion: (binaryLocation: string, target: PlatformTarget) => Promise<{ title: string, id: string }>,
  // Knowing binaryLocation can help (e.g. picking a release channel), but
  // this is expected to mostly be a network call, not a local read. No
  // target - the answer ("what's the latest upstream version") doesn't vary
  // by platform.
  getSupportedVersion: (binaryLocation: string) => Promise<{ title: string, id: string }>,
  // Optional - a plugin without one just means no in-app update; the user
  // downloads a new version and re-points binaryLocation at it themselves.
  // `target` is a floor, not a ceiling: the call guarantees at least that
  // platform/arch gets updated, but a plugin may update other slots too as
  // a side effect (e.g. one upstream artifact that already bundles every
  // platform). Callers never loop over supportedPlatforms to force full
  // coverage themselves - whether the bundle ends up complete for every
  // platform after one call is entirely the plugin's own choice.
  updateBinary?: (binaryLocation: string, target: PlatformTarget) => Promise<void>,
  // Checks whether binaryLocation actually has a usable binary for `target`
  // - "does the binary this host would run actually exist at the resolved
  // path" (and on POSIX, is it executable) - so a caller can surface a
  // plugin-authored reason (e.g. "no linux-x64 build in this folder")
  // instead of a raw ENOENT/spawn error from startGame. Takes the same
  // target startGame will actually receive, since that's the call it's
  // answering for.
  validateBinaryLocation: (
    binaryLocation: string, target: PlatformTarget
  ) => Promise<{ valid: true } | { valid: false, message: string }>,

  startGame: (
    binaryLocation: string, target: PlatformTarget, connectionConfig: ConnectionConfig, args: StartGameArgs<T>
  ) => Promise<GameProcessHandle>,
};
