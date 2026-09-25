========================
 Kung Fu Man (Shadow)
========================

A custom roster entry built for this repo's examples: Elecbyte's Kung Fu Man
(logic, body sprites, sounds, all moves - unchanged, (c) 2009 Elecbyte,
Creative Commons Noncommercial License, attribution optional), given a
JoJo's Bizarre Adventure-style "Stand"-style spirit called the Shadow: a
translucent spirit that hovers behind him at all times and can be called on
to strike for him.

KFM himself is 100% vanilla - every one of his own sprites, animations and
moves is byte-for-byte identical to classic Kung Fu Man (verified against
kfm.sff). The ghost/genie look lives entirely on the Shadow, not on him -
an earlier pass tried bolting a tail overlay onto KFM's own legs and it
never worked right (a static overlay can't track a leg that lifts/crosses
per animation frame). Giving the Shadow its own dedicated sprite sidesteps
that problem completely.

What's new here (not from Elecbyte):
- The Shadow: a fully custom sprite (not a copy of KFM's own) - a floating
  torso and arms tapering into a swaying, tapering genie tail in place of
  legs, rendered via an additive Trans blend, topped with a jack-o'-lantern
  head. The head is composited pixel-for-pixel from a 32x32 reference
  pumpkin icon (its white background mapped to transparency); the body is
  flattened to a matching flat orange fill with a black rim so the two read
  as one consistent pixel-art style. 4 frames (64x110px, own 6-color
  palette) were appended into kfm_shadow.sff as sprite group 9902 via a
  small SFF v2 append tool. It's a first pass - hand-edit group 9902 for a
  different look; no
  .air/.cns changes are needed for that; [Statedef 9801]/[Statedef 9802] in
  kfm.cns and [Begin Action 9902] in kfm.air already reference it.
- It's permanent, not summon-on-demand: "Shadow Spawner" in kfm.cns
  (re)spawns it as a helper bound behind KFM (BindToParent) whenever it's
  missing, including at the start of each round (Ikemen clears helpers
  between rounds). It idles in [Statedef 9801].
- A new special move, Summon Shadow (D, DF, F, z - button z is otherwise
  unused by classic KFM): KFM briefly channels (reusing the Kung Fu Palm
  swing, anim 1000, as a placeholder gesture - swap the `anim` in
  [Statedef 9800] once dedicated art exists); the Shadow notices via a
  `Parent,` trigger redirect watching the player's own cast state/anim, and
  switches from idling ([Statedef 9801]) to lunging in and striking once
  ([Statedef 9802]), then returns to hovering behind him instead of
  vanishing.
- The select/vs-screen portraits (group 9000, sprites 0 and 1) were redrawn
  with the Shadow peeking out from behind his shoulder on a translucent
  tail, so this variant reads as distinct from classic KFM on the
  character select screen instead of sharing his portrait. The head is the
  same reference pumpkin icon as the in-game Shadow, composited in full.
  Both portrait palettes had unused opaque-black padding slots (verified
  unreferenced by any other sprite in the file) repurposed for the icon's
  exact colors, rather than approximating against KFM's own skin-tone
  ramp. The pumpkin's orange fill is alpha-blended with whatever portrait
  pixel is underneath at composite time (60% pumpkin / 40% KFM, baked into
  a new palette entry per underlying color actually encountered) so his
  face/shoulder show through; the carved black outline/eyes/mouth stay
  fully opaque so the face itself doesn't go soft. A snapshot from before
  this translucency pass lives in the sibling `chars/kfm_shadow-backups/`
  folder (kept out of `chars/kfm_shadow/` itself so it doesn't trip the
  build's asset-glob validation).

A note on the hover: an earlier pass also tried giving KFM himself a small
constant Y-offset (state -2 PosSet) so he'd read as floating rather than
standing. It produced visible jitter with no clearly visible hover to show
for it, so it was cut rather than kept tuned blind - see the "REMOVED" note
near the top of [Statedef -2] in kfm.cns.

Everything else - basic moves, throws, the other special/hyper attacks - is
identical to classic Kung Fu Man; see chars/kfm/readme.txt for the full
base move list.
