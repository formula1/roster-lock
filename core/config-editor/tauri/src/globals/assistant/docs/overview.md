# RosterLock Config Editor

This app edits a **draft** of a game's RosterLock config: a JSON file that
describes an "engine" (piece types), a "roster" (the actual pieces/content
for each type), and "selection" rules (how players pick pieces at runtime).

A draft wraps:
- `stagedLock` - the config currently being edited.
- `previousLock` - the last published baseline, used to diff and compute the
  next semver version.
- draft-only bookkeeping the user doesn't edit directly.

## The three main sections

**Engine** (page id `engine`) - defines piece *types*. For each piece type:
a selection strategy (`mandatory`/`shared`/`personal`/`on-demand`), which
other piece types it `requires`, path variables used in asset globs, and
asset definitions (name, classification, glob pattern, expected file count).
This is schema, not content - no real files yet.

**Roster** (page id `roster`) - the actual pieces (content) that satisfy an
engine piece type. Each roster piece has: `humanInfo` (name/author/url/
image), `downloadSources` (URLs others can fetch it from), `pathVariables`,
`requiredPieces`, and a content-hash `version` computed by scanning a folder
against the piece type's asset definitions. Adding a piece means pointing
the editor at a folder; the folder is scanned and hashed automatically.

**Selection** (page id `selection`) - per-piece-type rules for how a player
picks pieces at runtime: `normal` (needs validation: count/unique/banList/
customValidation), `preselected` (fixed list), `unselectable`, or
`game-controlled`. Also holds selection scripts (custom validation/merge
logic) and global validation rules that span multiple piece types.

## Typical workflow order

1. Start a draft (new, or from an existing published lock).
2. Define engine piece types and their asset definitions.
3. Use "Engine test" (page id `engine-test`) to check a real folder against
   an asset definition before committing to it.
4. Add roster pieces (scan real folders in).
5. Configure selection per piece type.
6. Validate, then promote and/or publish.

## Validation vs. warnings

A draft is allowed to be incomplete/WIP - the app does not block editing on
missing fields. Validation (blocking, checked before publish/promote) is run
explicitly by the user, not by this assistant.

## What this assistant should do

- Answer questions about how the editor / the config format works, using
  these docs.
- Navigate the user to the right page for a task (`navigate` tool) rather
  than trying to describe UI they should instead be looking at.
- Where asked, help fill out `humanInfo` for a newly-added roster piece by
  reading files in its folder - see `human-info.md`.

It should not silently edit form fields without the user reviewing the
proposed value first.
