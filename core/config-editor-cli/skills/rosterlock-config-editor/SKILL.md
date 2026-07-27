---
name: rosterlock-config-editor
description: Create and edit roster-lock config drafts (engine piece types, roster pieces, selection config) using the rosterlock CLI, and validate/promote/publish them. Use whenever asked to build, edit, inspect, or validate a *.rosterlock.draft.json or *.rosterlock.json file.
argument-hint: e.g. "create a draft for a new game called Foo" or "add a character piece type with a sprite asset"
---

# rosterlock CLI

`rosterlock` is the CLI for building and editing roster-lock config files: the
engine's piece-type definitions, the roster of actual pieces per type, and the
per-type selection config. This skill ships inside the `@roster-lock/config-editor-cli`
package itself (this file lives at `skills/rosterlock-config-editor/SKILL.md`
relative to that package's root, `core/config-editor-cli/` in the roster-lock
monorepo) so it travels with the CLI - installing or cloning just this package is
enough to have it.

It edits a **draft** file (`*.rosterlock.draft.json`), which wraps a `stagedLock`
(the config being built), a `previousLock` (the last published baseline, for
semver diffing), and draft-only bookkeeping (`draft.rosterPieceInfo`,
`draft.selectionScriptInfo`).

**`--help` is the source of truth for exact flags.** This doc gives you the shape
of the CLI and the order operations need to happen in; run
`$ROSTERLOCK <command> --help` before using a command you haven't used yet in this
session, and re-check it if a command errors on unrecognized/missing flags - flags
do change as the CLI evolves and this doc can drift.

## Getting a runnable binary

From this package's root, build a standalone binary (bundled via esbuild, packaged
via `@yao-pkg/pkg` - runs without `pnpm`/`node_modules` on `PATH`):

```bash
pnpm run package
```

This produces `bin/rosterlock-config-editor` (gitignored, built on demand - targets
`node24-linux-x64` by default; edit the `package` script in `package.json` to add
other targets like `node24-macos-arm64`/`node24-win-x64` if needed). Check whether
it already exists before rebuilding - it only needs to be regenerated after source
changes:

```bash
test -x bin/rosterlock-config-editor || pnpm run package
```

If you only need to run something once and don't want to package a binary, and
you're working inside the roster-lock monorepo (this package's dependencies are
workspace-linked there), `pnpm dev -- <args>` runs the CLI directly from source
via `tsx` (no build/package step, slightly slower startup).

All examples below assume `ROSTERLOCK=./bin/rosterlock-config-editor` (adjust the
path if you're invoking it from elsewhere - e.g. `pnpm dev --` if running from
source).

## Command map

```
$ROSTERLOCK draft init [path] --title <t> --author <a>
$ROSTERLOCK draft from-lock <lockPath> [draftPath] [--clear-rosters]
$ROSTERLOCK draft validate [-d <draft>]     # strict: every issue blocking publish/promote, at once
$ROSTERLOCK draft promote [-d <draft>]      # stagedLock becomes the new previousLock baseline
$ROSTERLOCK draft publish <outLockPath> [-d <draft>]  # writes a standalone versioned lock file

$ROSTERLOCK validate [-d <draft>] [--lock <path>]  # looser structural check (drafts are allowed to be WIP)
$ROSTERLOCK show [-d <draft>]                       # print stagedLock as JSON

$ROSTERLOCK engine set-info --name <n> --engine-version <v> [-d <draft>]
$ROSTERLOCK engine add-piece-type <pieceType> --strategy <s> [--requires <t,..>] [--path-variables <n,..>] [--json <file|->]
$ROSTERLOCK engine edit-definition <pieceType> [--strategy <s>] [--requires <t,..>] [--path-variables <n,..>] [--json <file|->]
$ROSTERLOCK engine add-asset <pieceType> <assetName> --classification <c> --count <n> --glob <pattern> [-d <draft>]
$ROSTERLOCK engine remove-asset <pieceType> <assetName> [-d <draft>]
$ROSTERLOCK engine remove-piece-type <pieceType> [-d <draft>]   # refuses if the roster still has pieces
$ROSTERLOCK engine show [pieceType] [-d <draft>]

$ROSTERLOCK roster add-piece <pieceType> <folder> [--path-variables <k=v,..>] [--download-source <url>] [--json <file|->]
$ROSTERLOCK roster edit-piece <pieceType> <pieceId> [--name/--author/--url/--image <v>] [--add-download-source <url>] [--remove-download-source <url>] [--path-variables <k=v,..>] [--remove-path-variable <name>] [--json <file|->]
$ROSTERLOCK roster rescan <pieceType> <pieceId> [folder] [--path-variables <k=v,..>]  # recompute hashes in place after asset/file changes; keeps id, humanInfo, downloadSources, requiredPieces
$ROSTERLOCK roster test-download <pieceType> <pieceId> <sourceUrl>   # downloads and verifies a source's hash matches
$ROSTERLOCK roster remove-piece <pieceType> <pieceId>
$ROSTERLOCK roster list [pieceType] [-d <draft>]

$ROSTERLOCK selection add-script <fileOrFolder> [--key <relPath>]
$ROSTERLOCK selection set <pieceType> --type <normal|preselected|unselectable|game-controlled> [--json <file|->]
$ROSTERLOCK selection run-script <scriptRef>
$ROSTERLOCK selection show [-d <draft>]
```

The `-d, --draft <path>` option (present on almost every command) defaults to the
sole `*.rosterlock.draft.json` file in the current directory - only pass it
explicitly when there's more than one draft in play, or you're not running from
the draft's directory.

## Typical workflow

1. **Start a draft.** Either `draft init` (empty) or `draft from-lock <existing.rosterlock.json>`
   (start from a published lock; add `--clear-rosters` to keep the engine config
   but start with empty rosters/selection - useful for "same game, new content
   season").
2. **Define the engine** (piece types): `engine add-piece-type`, then
   `engine add-asset` for each asset the piece type needs. `engine edit-definition`
   changes strategy/requires/path-variables later without re-adding assets.
3. **Populate rosters** (actual pieces): `roster add-piece <type> <folder>` scans a
   folder against the piece type's asset definitions and computes content hashes.
   It needs at least one download source, from `--download-source`, a
   `rosterlock.piece-meta.json` in the folder, or `--json`. Use `roster edit-piece`
   to fix up humanInfo/sources/path-variables afterward. Its id is derived from
   `humanInfo` (`@author/name`, or `#logicHash/mediaHash` if unnamed) - there's no
   flag to set it directly. To update an **existing** piece's files (e.g. after
   adding a new asset type or editing media) without changing its id or losing its
   `requiredPieces`, use `roster rescan <type> <pieceId> [folder]` instead of
   removing and re-adding it - `add-piece` always resets `requiredPieces` to empty
   stubs, which `roster edit-piece` cannot restore.
4. **Configure selection** per piece type: `selection set <type> --type <kind>`.
   `normal` needs `validation` (count/unique/banList/customValidation); `preselected`
   needs `pieces`; `unselectable`/`game-controlled` need neither - just `pieceMeta`
   if you're using per-piece metadata. Pass the type-specific fields via `--json`
   (see shape in `selection set --help`).
5. **Validate before finishing up**: `draft validate` runs the full (non-draft)
   schema against `stagedLock` and reports *every* issue in one pass (not just the
   first) - use it to iterate through problems instead of running `publish`
   repeatedly. (Plain `validate` without `draft` only checks structure - it
   deliberately allows an in-progress/incomplete draft.)
6. **Promote and/or publish**: `draft promote` moves `stagedLock` forward as the
   new `previousLock` baseline (for future diffs) without producing an output file.
   `draft publish <path>` writes a standalone, semver-bumped lock file and prints
   why the version changed, without touching the draft.

## `--json` inputs

Several commands accept `--json <file>` to supply structured input too large/awkward
for flags (full piece-type definitions, type-specific selection fields, bulk piece
edits). Pass `-` instead of a file path to pipe JSON via stdin instead of writing a
temp file - handy when generating the JSON programmatically:

```bash
echo '{"selectionStrategy":"shared","requires":[],"pathVariables":[],"assets":[]}' \
  | $ROSTERLOCK engine edit-definition character --json -
```

Every `--json` input is validated with zod before use; the command's `--help`
prints the exact expected shape (e.g. `Shape: { selectionStrategy: "mandatory" |
... }`). A shape mismatch fails fast with a per-field error - fix the JSON and
retry rather than guessing.

## Error output

Validation errors (from `--json` shape checks, or from `draft validate`/`publish`/
`promote` against the full lock schema) print one issue per line as
`<path> <message>`, and the process exits non-zero. Multiple issues are reported
together, not just the first - read the whole list before making changes.
