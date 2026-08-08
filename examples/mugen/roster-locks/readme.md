# MUGEN / Ikemen GO example

A roster-lock config built from real MUGEN content, used to drive the
`@roster-lock/game-runner-ikemen-go` plugin. `pieces/` holds six characters and two
stages; everything else here is generated from them.

## Rebuilding

```sh
bash build-draft.sh
```

That regenerates `mugen.rosterlock.draft.json` and the four published locks. It goes
through `config-editor-cli`, so the piece version hashes come from the CLI's own folder
scan rather than being written by hand - touch a piece and its logic/media hash moves
the way it would in the real editor.

## The `defName` path variable

Both piece types declare a `defName` path variable, and the `definition` asset is
`count: 1` with glob `<defName>.def`. That's what the game-runner plugin reads to build
`-p<n>` and `-s`, and it can't be inferred from anything else:

- match-agent names downloaded piece folders with a ULID, so the folder never carries
  the character's name.
- A character folder holds more than one `.def` - `kfm/` has `intro.def` and
  `ending.def` next to `kfm.def`, storyboards named from inside the character's own def.
- The def's basename doesn't have to match its own assets. `kfm_zss/` is `kfm_zss.def`
  with `kfm.sff`/`kfm.snd`/`kfm.air`, and Ikemen's own shipped `kfmZ` is `kfmZ.def` with
  the same `kfm.*` assets.

## Selection configs

One lock per Ikemen team mode, differing only in how many characters a player picks:

| lock | picks per player | tag |
|---|---|---|
| `mugen-single.roster-lock.json` | 1 | `single` |
| `mugen-simul.roster-lock.json` | 2 | `simul` |
| `mugen-tag.roster-lock.json` | 3 | `tag` |
| `mugen-turns.roster-lock.json` | 4 | `turns` |

All four hashes are registered in `engine.officialSelections` in *every* lock, so a
matchmaker holding any one of them can recognise the others. The tags are Ikemen's own
`TeamMode` names because the plugin looks the room's selection hash up in that list and
uses the tag as `-tmode`.

## Engine version

**These pieces need Ikemen GO v1.0.0-rc.2 or newer.** Older builds fail to *load* some
of the characters outright:

| character | v0.98.2 | v0.99.0 | v1.0.0-rc.2 |
|---|---|---|---|
| kfm, kfm720, Baiken | ✓ | ✓ | ✓ |
| Kyo | ✗ | ✗ `Kyo.cns:53 Invalid data: motifstate` | ✓ |
| kfm_zss | ✗ | ✗ `AI.zss:156 Invalid data: jugglepoints` | ✓ |
| kfm_zaxis | ✗ | ✗ `kfm.zss:67` | ✓ |

The ZSS characters use Ikemen's own scripting language, which is still moving, so they
track the engine closely. On rc.2 all six load; Kyo, kfm720 and Baiken emit non-fatal
warnings (unknown state-controller parameters, one missing sprite in `Baiken.sff`).

This is a note about these particular pieces, not something the lock declares. A lock
describes how its files are laid out and loaded - that's what the engine config and its
sha are for - and says nothing about which engine build a player runs. Engine versions
are handled by the game runner: `getLocalVersion` reads what a player has installed, and
matching it across a room happens there. What belongs here is the loading contract; if
Ikemen ever changes how it loads these files, that's an engine config change.
