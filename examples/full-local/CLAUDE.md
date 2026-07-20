# Assistant notes for examples/full-local

## Roster-lock files

- `simple-game.roster-lock.json` is a **published, compiled artifact**. Never
  hand-edit it directly.
- `simple-game.rosterlock.draft.json` is the **editable source of truth**. All
  changes to the roster-lock config (engine piece types, rosters, selection
  config) go through this draft.

Use the `rosterlock` CLI (`core/config-editor-cli` in this monorepo) to make
changes - never edit either JSON file by hand. Full command reference and
workflow: [`core/config-editor-cli/skills/rosterlock-config-editor/SKILL.md`](../../core/config-editor-cli/skills/rosterlock-config-editor/SKILL.md).

Running it from inside the monorepo (workspace-linked deps, no build step):

```bash
cd core/config-editor-cli
pnpm run dev draft <command> ... -d /path/to/examples/full-local/simple-game.rosterlock.draft.json
```

### Workflow for updating the published lock

1. **Before making any new edits**, promote the currently staged lock:
   `pnpm run dev draft promote -d <draft path>`. This overwrites `previousLock`
   with the current `stagedLock`, so it reflects what's actually published
   right now. `draft publish` (step 4) never updates the draft file itself
   (it only writes the output lock file) - so without this step, `previousLock`
   stays frozen at whatever it was after the last `draft from-lock`/`promote`,
   and a later publish's diff/semver bump would be computed against that stale
   baseline instead of the real last-published state.
2. Edit `simple-game.rosterlock.draft.json` via `rosterlock` subcommands
   (`engine ...`, `roster ...`, `selection ...`) - not by hand.
3. Validate: `pnpm run dev draft validate -d <draft path>`. Fix every
   reported issue (it reports all of them, not just the first) before moving on.
4. Publish: `pnpm run dev draft publish <path-to>/simple-game.roster-lock.json -d <draft path>`.
   This overwrites `simple-game.roster-lock.json` with a new semver-bumped
   version and prints a changelog of what changed.

Note: the publish diff can print spurious `Removed a Piece` / mismatched
"old"/"new" lines when multiple roster pieces share identical content hashes
(e.g. several pieces with empty logic/docs files hash to the same value) -
confirm with `git diff simple-game.roster-lock.json` that data wasn't
actually lost before treating those lines as real regressions.
