==========================
 Training Room (Storm)
==========================

A custom roster entry built for this repo's examples: Elecbyte's Training
Room stage (camera, bounds, floor and wall sprites - unchanged, (c) 2009
Elecbyte, Creative Commons Noncommercial License, attribution optional),
given a rain-and-lightning overlay.

This replaces stage1 (a third-party CC BY 3.0 stage by Gacel) in the
roster. Same reasoning as kfm_thunder/kfm_shadow replacing Baiken/Kyo:
rather than bundle another author's asset, this is a second stage built
entirely from Elecbyte's own base plus small original additions - see
the roster-locks readme for the fuller rationale.

What's new here (not from Elecbyte):
- 2 new sprites appended into stage0_storm.sff as sprite group 500 via a
  small SFF v2 append tool (encoded as self-contained truecolor PNGs -
  format 12/coldepth 32 - so no changes were needed to stage0's existing
  sprites or its palette table):
  - 500,0: a 32x64 tileable rain-streak texture, hand-drawn as a handful
    of diagonal semi-transparent streaks with staggered vertical phase so
    the tile seams don't line up into visible rows.
  - 500,1: a 320x240 solid near-white fill used as the lightning flash.
- Everything driving those two sprites in stage0_storm.def is native,
  documented stage.def functionality - stages can't run character code
  (there's no per-stage state machine the way a character has one), so
  there's no PalFX-style screen flash controller available here the way
  there would be from a character's state file. Concretely:
  - [BG Rain] (id 1): tiled infinitely, given a constant `velocity` that
    falls along the same diagonal the streaks are drawn at, plus a slow
    `sin.x` sway on top for a gusting-wind feel. Foreground layer
    (layerno 1) so it's visible over the players.
  - [BG Flash] (id 2): the full-screen white sprite, drawn with
    `trans = add` so it brightens the scene instead of covering it,
    normally invisible. A [BGCtrlDef]/[BGCtrl] block toggles its
    `Visible` state on the flash sprite's id for a quick double-flash
    every ~8 seconds (480 ticks at 60fps), with explicit On/Off windows
    covering the whole loop rather than relying on it auto-reverting
    after a window ends (confirmed against Ikemen's own source that
    Visible latches at its last-set value, not just holds during its
    window).

Everything else - camera bounds, player start positions, shadow/
reflection settings, the floor and wall themselves - is identical to
the base Training Room stage.
