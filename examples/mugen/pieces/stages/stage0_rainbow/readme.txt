==========================
 Training Room (Rainbow)
==========================

A custom roster entry built for this repo's examples: Elecbyte's Training
Room stage (camera, bounds, floor and wall sprites - unchanged, (c) 2009
Elecbyte, Creative Commons Noncommercial License, attribution optional),
given a rainbow-arc and sparkle overlay.

Same reasoning as kfm_thunder/kfm_shadow replacing Baiken/Kyo, and
stage0_storm replacing stage1: rather than bundle another author's asset,
this is a second stage0 variant built entirely from Elecbyte's own base
plus small original additions - see the roster-locks readme for the fuller
rationale.

What's new here (not from Elecbyte):
- 2 new sprites appended into stage0_rainbow.sff as sprite group 500, via
  examples/mugen/utils/append-sff-sprites.js - a small, reusable SFF v2
  append tool (encoded as self-contained truecolor PNGs - format 12/
  coldepth 32 - so no changes were needed to stage0's existing sprites or
  its palette table). Source art lives alongside this file:
  - 500,0 (rainbow-arc.png): a 320x150 semi-transparent rainbow-ring
    cutout, procedurally drawn as 7 concentric ROYGBIV bands with a
    transparent hole punched through the middle, forming an arch.
  - 500,1 (rainbow-sparkle.png): a 64x64 tileable scatter of small
    rainbow-colored glint shapes on a transparent background.
- Everything driving those two sprites in stage0_rainbow.def is native,
  documented stage.def functionality - stages can't run character code
  (there's no per-stage state machine the way a character has one).
  Concretely:
  - [BG Rainbow Arc] (id 1): drawn once behind the players (layerno 0, on
    top of the wall/floor since it's listed after them), with a slow
    `sin.y` bob for a gentle floating feel. `start.x = -160` (half the
    sprite's own width, negated) because for a non-tiled BG, start.x = 0
    puts the sprite's *left edge* at world x=0, which maps to
    screen-center rather than the screen's left edge - a full-width
    single sprite needs start.x = -width/2 to actually center. `start.y =
    35` puts its bottom edge flush with the floor sprite's own start (185).
  - [BG Sparkle] (id 2): tiled infinitely and drifting slowly upward via
    `velocity`, drawn additively in the foreground (layerno 1) so it reads
    clearly over the players.
  - Both use `mask = 1` in the .def, not stage0's own `mask = 0`. These
    are truecolor PNG sprites carrying real per-pixel alpha; Ikemen's
    sprite shader only reads that alpha when mask is truthy - mask = 0
    (right for stage0's own opaque indexed floor/wall sprites) forces
    alpha to 1.0 instead, which is what made an early version of this
    render as a solid black box rather than transparent.

Everything else - camera bounds, player start positions, shadow/
reflection settings, the floor and wall themselves - is identical to
the base Training Room stage.
