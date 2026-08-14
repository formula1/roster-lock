# @roster-lock/game-runner-ikemen-go

A `game-runner` plugin that launches [Ikemen GO](https://github.com/ikemen-engine/Ikemen-GO)
straight into a match via its Quick-VS command line (`-p1`..`-p8`, `-tmode1`/`-tmode2`,
`-s`, `-ip`, `-setport`), skipping Ikemen's own menus/select screen entirely. Selection
UI, matchmaking, and downloading are all owned by roster-lock; this plugin's only job is
turning a finished selection into a running Ikemen process.

## Piece type convention

`RosterLockEngineConfig.pieceDefinitions` keys are arbitrary strings chosen by whoever
writes the engine config - this plugin can't discover them on its own. It expects an
Ikemen engine config to name its two piece types exactly `character` and `stage`
(see `src/pieceTypes.ts`). An engine config that uses different names won't work with
this plugin without changing one or the other.

## The `defName` path variable

Both piece types must also declare a `defName` path variable, and every roster piece
must supply a value for it - `{ "defName": "kfm" }` means that piece's folder contains
`kfm.def`. This is required, not optional; `startGame` throws with a message naming the
offending piece if it's missing.

It can't be inferred. match-agent names each downloaded piece folder with a ULID (see
`SQLFolderDB`'s `ensurePieceExists`), so the folder never carries the character's name,
and "just glob for the one `.def`" doesn't work either - a character's `intro`,
`ending`, `arcadepath` and `ratiopath` storyboards are themselves `.def` files sitting
in the same folder, named from inside the character's own def. Ikemen's kfm ships three.

Ikemen is handed the `.def` file itself, never the folder. Its char loader
(`Select.AddChar`) only infers `<name>/<name>.def` from a bare name containing no `/`;
a path with a slash that doesn't already end in `.def` just gets `.def` appended, which
for a folder path names a *sibling* of that folder. `FileExist` rejects directories
outright regardless. Absolute paths outside the Ikemen install are fine - `SearchFile`
tries `filepath.IsAbs(file)` before prefixing anything with `chars/`, so piece folders
need no symlink into the Ikemen tree.

## Working directory

`startGame` spawns Ikemen with `cwd` set to `dirname(binaryLocation)`. Ikemen resolves
`data/`, `external/` and `save/` against the working directory, and only chdirs to its
own location on Android and inside macOS app bundles - so launching it from wherever
match-agent happens to be running dies immediately on
`external/script/main.lua: no such file or directory`. This means `binaryLocation` has
to point at the binary *inside a complete Ikemen install*, not a copy of it somewhere.

## Connection modes

Only `direct-tcp` is in `supportedConnectionModes`, and it's fully working: the room
host's `connectionConfig` has `party: "host"` (`-ip ""` - an *empty* value, not an
omitted flag; see below - listening on `connectionConfig.port`); everyone else gets
`party: "client"` (`-ip connectionConfig.hostIp`, same port). This plugin never talks to
a coordinator itself and has no dependency on `@roster-lock/direct-ip-coordinator` at
all - `connectionConfig` here is already resolved by the time `startGame` sees it.
Whoever called `startGame` (in practice: match-agent's own `GameRunner.startGame`, see
`core/plugin-runtime/src/GameRunner.ts`) took a `ConnectionSetup` carrying a
`coordinator: { host, port }` address instead, and ran the rendezvous handshake against
it before ever invoking this plugin - the host registers once its process is spawned, a
client blocks until the host has, then learns the host's real address from the reply.
See `@roster-lock/direct-ip-coordinator`'s own comments and
`docs/v2/ikemen-go/game-coordinator.md` for that handshake itself.

The address handed back prefers localhost/LAN over routing out through whatever's
reachable from outside the coordinator: the host reports its own non-internal network
addresses when it registers, and a client the coordinator sees arriving from the same
network as the host (same observed remote address - true both for literally the same
machine and for two different machines behind the same NAT/router) gets one of those
addresses instead of the host's address as seen from outside. `"127.0.0.1"` remains the
fallback only when the host reported no usable local address.

### `-ip` must be present on both sides - "omit" and "blank" are not the same

Ikemen's own `-h` output is explicit: `-ip <hostip> Connect to <hostip> for netplay;
leave blank for host`. An earlier version of this plugin took "leave blank" to mean
"omit the flag" and never passed `-ip` for the host at all - that's wrong. Without
`-ip` present on the command line, Ikemen doesn't engage netplay at all: it starts an
immediate local Quick VS match with local input controlling every side, no listening,
no handshake. That's indistinguishable from a working netplay host until you notice a
"client" process sitting idle with nothing to connect to. `buildArgs.ts` passes
`-ip ""` (the flag, with an empty value) for the host and `-ip <address>` for the
client - both sides always pass the flag.

`room` and `internal` are **not** claimed as supported, on purpose - `room` needs a real
bridge that tunnels Ikemen's TCP connection over whatever the room's actual transport is
(WebRTC data channel, websocket, etc. - see the "WebRTC games" design discussion for the
intended shape: two local bridge processes, ICE/SDP signaled through the relay room),
and that bridge doesn't exist yet. Don't add `"room"` to `supportedConnectionModes` until
`startGame` actually handles it - a plugin claiming a mode it can't fulfill is worse than
one that's honest about not supporting it yet.

## Version checking

Ikemen GO has no `-version` flag. `processCommandLine` (`src/main.go`) has no case for
one, its `-h` help text lists every option it does accept, and an unrecognised flag isn't
rejected - it lands in `sys.cmdFlags` and the engine boots anyway, so probing for a
version flag would start a match. The engine's `Version` is a link-time variable
(`var Version = "development"`, overridden with `-X main.Version=...` by
`build/build.sh`) that only a *running* engine surfaces, via the panic handler and the
Lua `version()` binding.

Both functions answer without starting anything: `getLocalVersion` reads the executable,
`getSupportedVersion` asks GitHub what the current release is.

### `getLocalVersion` reads the binary

Ikemen is a Go program, and every Go binary since 1.18 carries the build-info blob that
`go version -m` prints. The parts worth having are plain tab-separated text, so a byte
scan gets at them with no ELF/PE/Mach-O parse and no Go toolchain - the same code works
on `Ikemen_GO_Linux`, `Ikemen_GO.exe` and `Ikemen_GO_MacOS`.

**`id` is the commit** (`vcs.revision`), and it's what "is everyone in this room on the
same build" has to compare. It's the only field that can do that job, because a room
mixes platforms: hashing the file would report a mismatch between a Windows player and a
Linux player running the same release, while the recorded commit doesn't vary by platform
- the v0.98.2 zip's `Ikemen_GO.exe` and `Ikemen_GO_Linux` both report `38c7957`.

**`title` is what the build calls itself**, and it's what the "you're behind" notice
compares and displays. Two sources, because neither covers every build:

| source | v0.98.2 | v0.99.0 | v1.0.0-rc.2 | nightly |
|---|---|---|---|---|
| `-ldflags` recorded in build info | ✗ | ✓ | ✗ | ✓ |
| NUL-padded `-X` literal in the data section | ✗ | ✗ | ✓ | ✗ |

The literal scan is a heuristic - it keys off the linker giving each `-X` string its own
padded slot, not off a documented layout - so it only reports a title when it finds
exactly one candidate. `main.BuildTime` sits in the neighbouring slot and is
version-shaped (`build.sh` defaults it to `date +%Y.%m.%d`), so dates are filtered out.
When nothing is found the title falls back to `unknown build (<short commit>)`, which
still displays and still compares.

### `getSupportedVersion` is one API call

`GET /repos/ikemen-engine/Ikemen-GO/releases/latest` gives both halves with no download.
For v1.0.0-rc.2 its `tag_name` is byte-identical to the literal baked into the released
binary, and its `target_commitish` is the same commit that binary records. Ikemen marks
its release candidates `prerelease: false`, so `/latest` resolves to rc.2 rather than
skipping back to v0.99.0.

`binaryLocation` is read to pick the channel. The nightly release re-points constantly
and calls itself `nightly` forever, so a nightly user compared against the stable channel
would be permanently "behind" something they didn't ask for. **For a nightly the
behind-check has to compare `id`, not `title`** - every nightly is titled `nightly`.

Responses are cached for five minutes. Unauthenticated GitHub allows 60 requests an hour
per IP and nothing stops a settings screen from asking on every render.

### What this can't do

- **Deriving a commit from a tag is not reliable**, so don't use `id` as the
  behind-the-latest signal on the stable channel. A tag's commit isn't guaranteed to be
  the commit the release *binary* was built from: the official v0.98.2 zip records
  `38c7957` while the v0.98.2 tag points at `69b3936`. `target_commitish` is used when
  it's a commit and the tag is only resolved as a fallback (older releases store a branch
  name there - v0.99.0's is `master`).
- **Pre-Go-1.18 builds can't be identified at all** and `getLocalVersion` throws for
  them. The v0.98.2 zip's `Ikemen_GO_MacOS` was built with Go 1.15, before build settings
  and commit stamping existed - its Linux and Windows siblings in the same zip were built
  with Go 1.18rc1 and are fine. Nothing that old can host a roster-lock match anyway.
- **A dirty build is indistinguishable from the release it was built on.** `vcs.modified`
  is true even for the official v1.0.0-rc.2 release, so it can't be read as "somebody
  built this themselves", and two people building the same commit with different local
  edits report the same `id`.
- **Matching engines doesn't guarantee a desync-free match** - Ikemen's rollback netcode
  also needs identical character and stage content. That part is the lock's job, not
  this check's.

## Shared vs. local config

`gameConfigSchema` (`teamMode`, `roundTime`, `rounds`) is what a room creator picks once
for everyone - it arrives via `StartGameArgs["gameConfig"]`. `localConfigSchema` is empty
`{}` - the only per-machine value this plugin needs today is `binaryLocation`, which
`GameRunnerPlugin` already handles as its own first-class concept (passed directly to
`startGame`/`getLocalVersion`/`getSupportedVersion`), not something bundled into a
generic local-config blob. A preferred local port would belong here once `room` mode has
a bridge that needs one - `direct-tcp`'s port is chosen at room-creation time and arrives
already resolved on `connectionConfig`, so it isn't a local setting this plugin owns.

## Team mode comes from the selection config

An Ikemen engine config is expected to publish one selection config per team mode -
`single` lets a player pick 1 character, `simul` 2, `tag` 3, `turns` 4 - and register
each one in `engine.officialSelections` tagged with **Ikemen's own TeamMode name**. This
plugin hashes the room's `selection` (canonical JSON of that subtree alone, matching the
config editor's `selection hash`), looks the hash up in that list, and uses the tag as
the team mode.

That's the point of the tags: the room everyone joined already agreed on one selection
config, so the mode follows from it instead of being a separate setting that can
contradict how many characters people actually picked.

Resolution order is `gameConfig.teamMode` (an explicit override), then the official
selection's tag, then a last-resort guess from the character count. That last fallback
only fires for a selection config the engine hasn't registered, and it's a poor guess -
it can't tell `simul` from `tag` or `turns`, since all three just mean "more than one".
Registering your selection configs is what makes it accurate.

`gameConfig.teamMode` applies to both sides (Ikemen's `-tmode1`/`-tmode2` don't have to
match, but this plugin doesn't yet expose per-side config).

See `examples/mugen/build-draft.sh` for a worked example that builds all four.

Characters are dealt into `-p<n>` slots **interleaved by side**, not consecutively:
Ikemen derives a slot's side from its parity (`main.f_playerSide` - odd is side 1, even
is side 2), so side 1 gets 1/3/5/7 and side 2 gets 2/4/6/8. Numbering them consecutively
looks correct for a 1v1 and hands every side's second pick to the opponent in a
simul/tag match. Four per side is the cap (Ikemen's `MaxSimul`, and all `-p1..-p8` has
room for).

The schema takes the readable names, but `-tmode1`/`-tmode2` are emitted as the numbers
Ikemen's `TeamMode` enum uses (`single`=0, `simul`=1, `turns`=2, `tag`=3). Ikemen reads
those flags through Lua's `tonumber()`, so a name arrives as `nil` - which doesn't error
where you'd notice, it quietly drops the side to single before failing later in
`setTeamMode`. Keep the mapping in `buildArgs.ts` in sync with `TM_*` in Ikemen's
`src/system.go` if that enum ever gains a mode.

## No update support

No `updateBinary` - it's optional on `GameRunnerPlugin`, and there's no confirmed way to
resolve "latest Ikemen release" to a downloadable artifact URL here yet. A user updates
by downloading a new release themselves and re-pointing their local `binaryLocation`
setting at it.
