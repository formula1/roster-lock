#!/usr/bin/env bash
# Rebuilds mugen.rosterlock.draft.json from ./pieces using the config-editor CLI.
#
# Everything here is derived from what's actually in ./pieces - piece names and
# authors come from each .def's [Info] section, and the version hashes are
# computed by the CLI's own folder scan, so re-running this after touching a
# piece produces a new logic/media hash the same way the real editor would.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PIECES_DIR="$HERE/../pieces"
UTILS_DIR="$HERE/../utils"
CLI="/usr/local/bin/node $REPO/core/config-editor-cli/dist/index.js"
DRAFT="$HERE/mugen.rosterlock.draft.json"

# Portrait/preview thumbnails embedded into humanInfo.image, extracted from each
# piece's own .sff (character group 9000 = select-screen portrait, stage group
# 9000 = stage preview - both standard MUGEN conventions). Regenerated into a
# scratch dir every run rather than committed, same "derived from ./pieces"
# philosophy as everything else this script builds.
IMG_DIR="$(mktemp -d)"
trap 'rm -rf "$IMG_DIR"' EXIT

# Placeholder host - these pieces are served by the example's dockerized
# download-provider on port 7442, which is the public URL the relay clients
# and sync-dl flow use.
BASE_URL="http://localhost:7442/pieces"

rm -f "$DRAFT"
$CLI draft init "$DRAFT" --title "MUGEN / Ikemen GO" --author "roster-lock"
$CLI engine set-info --draft "$DRAFT" --name ikemen-go --engine-version 1.0.0

# --- character -------------------------------------------------------------
# `defName` is what the ikemen-go game-launcher plugin reads to build the -p<n>
# argument. It's a separate variable from the character's other asset names on
# purpose: in kfm_zss the def is kfm_zss.def while every asset it references is
# kfm.* (kfm.sff, kfm.snd, kfm.air), so one name can't cover both.
$CLI engine add-piece-type character --draft "$DRAFT" \
  --strategy personal --path-variables defName

# count 1 is the guarantee the plugin relies on: exactly one file is *the*
# character def. The intro/ending storyboards below are also .def files sitting
# in the same folder, which is why globbing *.def wouldn't be good enough.
$CLI engine add-asset character definition --draft "$DRAFT" \
  --classification logic --count 1 --glob '<defName>.def'
$CLI engine add-asset character storyboards --draft "$DRAFT" \
  --classification logic --count 0:'*' --glob 'intro.def' --glob 'ending.def'
$CLI engine add-asset character states --draft "$DRAFT" \
  --classification logic --count 1:'*' \
  --glob '**/*.cns' --glob '**/*.cmd' --glob '**/*.air' \
  --glob '**/*.const' --glob '**/*.zss'
$CLI engine add-asset character movelist --draft "$DRAFT" \
  --classification logic --count 0:'*' --glob 'movelist.dat'
$CLI engine add-asset character sprites --draft "$DRAFT" \
  --classification media --count 1:'*' --glob '**/*.sff'
$CLI engine add-asset character sounds --draft "$DRAFT" \
  --classification media --count 0:'*' --glob '**/*.snd'
$CLI engine add-asset character palettes --draft "$DRAFT" \
  --classification media --count 0:'*' \
  --glob '**/*.act' --glob '**/*.png' --glob '**/*.bmp'
$CLI engine add-asset character docs --draft "$DRAFT" \
  --classification doc --count 0:'*' --glob '**/*.txt'

# --- stage -----------------------------------------------------------------
$CLI engine add-piece-type stage --draft "$DRAFT" \
  --strategy shared --path-variables defName

$CLI engine add-asset stage definition --draft "$DRAFT" \
  --classification logic --count 1 --glob '<defName>.def'
$CLI engine add-asset stage sprites --draft "$DRAFT" \
  --classification media --count 1:'*' --glob '**/*.sff'
# Optional source art (e.g. PNGs spliced into the .sff via
# utils/append-sff-sprites.js) kept alongside the piece for future edits -
# same idea as the character "palettes" asset below.
$CLI engine add-asset stage art --draft "$DRAFT" \
  --classification media --count 0:'*' --glob '**/*.png'
$CLI engine add-asset stage docs --draft "$DRAFT" \
  --classification doc --count 0:'*' --glob '**/*.txt'

# --- portraits ---------------------------------------------------------------
extract_portrait(){
  local sffPath="$1" spriteKey="$2" outName="$3"
  /usr/local/bin/node "$UTILS_DIR/extract-sff-sprite.js" "$sffPath" "$spriteKey" "$IMG_DIR/$outName.png"
}

# kfm's own kfm.sff stores its 9000,1 portrait as RLE8, which extract-sff-sprite.js
# doesn't decode (see its header comment) - kfm_zaxis's copy of kfm.sff has the
# pixel-identical portrait stored as PNG8 instead, so borrow that one for both.
extract_portrait "$PIECES_DIR/chars/kfm_zaxis/kfm.sff" 9000,1 kfm
extract_portrait "$PIECES_DIR/chars/kfm720/kfm720.sff" 9000,1 kfm720
extract_portrait "$PIECES_DIR/chars/kfm_zaxis/kfm.sff" 9000,1 kfm_zaxis
extract_portrait "$PIECES_DIR/chars/kfm_zss/kfm.sff" 9000,1 kfm_zss
extract_portrait "$PIECES_DIR/chars/kfm_thunder/kfm_thunder.sff" 9000,1 kfm_thunder
extract_portrait "$PIECES_DIR/chars/kfm_shadow/kfm_shadow.sff" 9000,1 kfm_shadow

# All three stage variants share stage0's original sprites untouched (only group
# 500 overlay sprites differ - see the readme), so stage0 itself uses its real
# 9000,1 preview sprite as-is, but the storm/rainbow variants would get that exact
# same preview if extracted the same way - not representative of what makes them
# different. Instead, composite their own group-500 overlay art onto the base
# preview so each variant's thumbnail actually looks distinct.
extract_portrait "$PIECES_DIR/stages/stage0/stage0.sff" 9000,1 stage0

extract_portrait "$PIECES_DIR/stages/stage0_storm/stage0_storm.sff" 500,0 storm_rain
extract_portrait "$PIECES_DIR/stages/stage0_storm/stage0_storm.sff" 500,1 storm_flash
/usr/local/bin/node "$UTILS_DIR/compose-stage-preview.js" storm \
  --base "$IMG_DIR/stage0.png" --rain "$IMG_DIR/storm_rain.png" --flash "$IMG_DIR/storm_flash.png" \
  --out "$IMG_DIR/stage0_storm.png"

# stage0_rainbow's overlay sprites were appended from these same loose PNGs
# (see readme.txt), so use them directly rather than re-extracting from the sff.
/usr/local/bin/node "$UTILS_DIR/compose-stage-preview.js" rainbow \
  --base "$IMG_DIR/stage0.png" --arc "$PIECES_DIR/stages/stage0_rainbow/rainbow-arc.png" \
  --sparkle "$PIECES_DIR/stages/stage0_rainbow/rainbow-sparkle.png" --out "$IMG_DIR/stage0_rainbow.png"

# --- rosters ---------------------------------------------------------------
# kfm and kfm_zss both self-report as "Kung Fu Man" by Elecbyte, which would
# collide on the generated @author/name id - hence the explicit names here.
add_piece(){
  local type="$1" folder="$2" defName="$3" name="$4" author="$5" imageName="$6"
  local imageJson=""
  if [ -n "$imageName" ]; then
    imageJson=",\"image\":\"data:image/png;base64,$(base64 -w0 "$IMG_DIR/$imageName.png")\""
  fi
  printf '{"humanInfo":{"name":"%s","author":"%s","url":"%s"%s}}' \
    "$name" "$author" "https://example.local/mugen/$type" "$imageJson" \
    | $CLI roster add-piece "$type" "$PIECES_DIR/$folder" --draft "$DRAFT" \
        --path-variables "defName=$defName" \
        --download-source "$BASE_URL/$folder.tar" \
        --json -
}

add_piece character chars/kfm        kfm        "Kung Fu Man"          "Elecbyte" kfm
add_piece character chars/kfm720     kfm720     "Kung Fu Man 720"      "Elecbyte" kfm720
add_piece character chars/kfm_zaxis  kfm_zaxis  "Kung Fu Man Z Axis"   "Elecbyte" kfm_zaxis
add_piece character chars/kfm_zss    kfm_zss    "Kung Fu Man ZSS"      "Elecbyte" kfm_zss
add_piece character chars/kfm_thunder kfm_thunder "Kung Fu Man (Thunder)" "Elecbyte" kfm_thunder
add_piece character chars/kfm_shadow   kfm_shadow   "Kung Fu Man (Shadow)"   "Elecbyte" kfm_shadow

add_piece stage stages/stage0         stage0         "Training Room"          "Elecbyte" stage0
add_piece stage stages/stage0_storm   stage0_storm   "Training Room (Storm)"   "Elecbyte" stage0_storm
add_piece stage stages/stage0_rainbow stage0_rainbow "Training Room (Rainbow)" "Elecbyte" stage0_rainbow

# --- selection -------------------------------------------------------------
# The stage is a "shared" piece type, so every player picks one and they have to
# reconcile to a single stage - hence a merge algorithm. Same for every mode.
$CLI selection add-script "$HERE/selection-scripts/democracy-random.js" --draft "$DRAFT"
printf '{"validation":{"count":1,"unique":true,"banList":[],"customValidation":[]},"mergeAlgorithm":{"src":"democracy-random.js"}}' \
  | $CLI selection set stage --draft "$DRAFT" --type normal --json -

# One selection config per Ikemen team mode, differing only in how many
# characters a player picks. Each is published as its own lock, because a lock
# carries exactly one selection config - what ties them together is
# engine.officialSelections, which lists all four hashes under their tags so a
# matchmaker (or the ikemen-go plugin) can tell which mode a room is running.
#
# The tags are Ikemen's own TeamMode names on purpose: the game-launcher plugin
# looks the room's selection hash up in this list and uses the tag as -tmode.
MODES="single:1 simul:2 tag:3 turns:4"

set_character_selection(){
  printf '{"validation":{"count":%s,"unique":false,"banList":[],"customValidation":[]}}' "$1" \
    | $CLI selection set character --draft "$DRAFT" --type normal --json - > /dev/null
}

# Pass 1 - compute each mode's hash and register all of them, so that every
# published lock lists the full set rather than only its own.
for entry in $MODES; do
  tag="${entry%%:*}"; count="${entry##*:}"
  set_character_selection "$count"
  hash="$($CLI selection hash --draft "$DRAFT")"
  $CLI engine add-official-selection "$tag" --hash "$hash" --draft "$DRAFT"
done

$CLI validate --draft "$DRAFT"
echo "Wrote $DRAFT"

# Pass 2 - publish one lock per mode. The engine (officialSelections included)
# and the rosters are identical across all four; only `selection` differs.
for entry in $MODES; do
  tag="${entry%%:*}"; count="${entry##*:}"
  set_character_selection "$count"
  $CLI draft publish "$HERE/mugen-$tag.roster-lock.json" --draft "$DRAFT" > /dev/null
  echo "Published mugen-$tag.roster-lock.json ($count character(s) per player)"
done

# Leave the draft on "single" so re-running is deterministic.
set_character_selection 1
