# MUGEN / Ikemen GO example

A roster-lock config built from real MUGEN content, used to drive the
`@roster-lock/game-launcher-ikemen-go` plugin. `pieces/` holds six characters and three
stages; everything else here is generated from them.

The roster is deliberately all Elecbyte Kung Fu Man variants (the engine's own
CC-BY-NC-licensed tutorial character) rather than fan-made ports of commercial
fighting-game characters - it used to include a couple of those, but they were
dropped since bundling ripped sprites/voices from real games isn't something
worth risking even as an unofficial example.

The stages follow the same rule. All three are Elecbyte's own Training Room;
the second slot used to be a different author's stage (Gacel, CC BY 3.0) and
was dropped for the same reason the characters were. `stage0_storm` and
`stage0_rainbow` both reuse Elecbyte's floor/wall sprites unchanged and add
their own small overlay of original sprites appended into their own copy of
the .sff, via `utils/append-sff-sprites.js` - a small, reusable SFF v2 append
tool (see `pieces/stages/stage0_storm/readme.txt` and
`pieces/stages/stage0_rainbow/readme.txt` for what each overlay is and how
it's driven; stages can't run character code, so both rely on plain `[BG]`
params - `sin.y`/`velocity`/`tile` and `BGCtrl` scheduling - rather than
anything PalFX-like).

## Portraits and stage previews

`build-draft.sh` embeds a `humanInfo.image` (a base64 `data:image/png;...` URI, per
roster-lock's format) for every character and stage. Characters use
`utils/extract-sff-sprite.js` to pull group `9000,1` straight out of their `.sff` -
MUGEN's standard select-screen portrait. The tool only decodes the sprite formats
these pieces actually use (raw-indexed and literal-PNG, including working around a
real gotcha where the literal-PNG sprites' own embedded PLTE chunk is a degenerate
placeholder and the real colors come from the sprite's SFF-level palette instead,
plus another where a sprite header's `ofs` can be relative to either `lofs` or
`tofs` depending on its `flag` bit - see the tool's header comment for both) - it
doesn't implement MUGEN's RLE8/LZ5 sprite compression, so `kfm.sff`'s own portrait
(stored RLE8) is skipped in favor of the pixel-identical copy bundled with
`kfm_zaxis`/`kfm_zss`, which happens to store the same portrait as literal PNG.

Stages are different: all three variants share the exact same `9000,1` preview
sprite (they only add new sprites in group 500, see above), so extracting it
straight would give identical, non-representative thumbnails for `stage0_storm`/
`stage0_rainbow`. Instead `utils/compose-stage-preview.js` composites each
variant's own group-500 overlay art onto the base Training Room preview - the rain
streak + flash tint for storm, the arc + sparkle scatter for rainbow - so each
stage's thumbnail actually looks like what makes it different. It's a nearest-
neighbor, fixed-placement approximation, not a re-render of the stage.def's real
`[BG]` animation - good enough for a selection-screen thumbnail, not meant to be
pixel-accurate.

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
`count: 1` with glob `<defName>.def`. That's what the game-launcher plugin reads to build
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
| kfm, kfm720 | ✓ | ✓ | ✓ |
| kfm_zss | ✗ | ✗ `AI.zss:156 Invalid data: jugglepoints` | ✓ |
| kfm_zaxis | ✗ | ✗ `kfm.zss:67` | ✓ |

The ZSS characters use Ikemen's own scripting language, which is still moving, so they
track the engine closely. On rc.2 all four load; kfm720 emits non-fatal warnings
(unknown state-controller parameters).

This is a note about these particular pieces, not something the lock declares. A lock
describes how its files are laid out and loaded - that's what the engine config and its
sha are for - and says nothing about which engine build a player runs. Engine versions
are handled by the game runner: `getLocalVersion` reads what a player has installed, and
matching it across a room happens there. What belongs here is the loading contract; if
Ikemen ever changes how it loads these files, that's an engine config change.
