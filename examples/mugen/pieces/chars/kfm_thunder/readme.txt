========================
 Kung Fu Man (Thunder)
========================

A custom roster entry built for this repo's examples: Elecbyte's Kung Fu Man
(logic, body sprites, sounds, moves - unchanged, (c) 2009 Elecbyte, Creative
Commons Noncommercial License, attribution optional), plus a small set of new
lightning-bolt sprites drawn for this character and a state controller that
keeps them looping as a permanent electric aura.

What's new here (not from Elecbyte):
- 4 new sprite frames (group 9500, numbers 0-3) appended into kfm_thunder.sff
  alongside the original ~281 Kung Fu Man sprites - hand-drawn pixel art (a
  jagged bolt with a couple of branches per frame), not sourced from any
  existing game.
- A new [Begin Action 9500] loop in kfm.air cycling those 4 frames.
- A new [State -2, Thunder Aura] controller in kfm.cns (see bottom of file)
  that spawns a single bound Explod playing that loop, so the aura is visible
  and animating on every frame rather than tied to a specific move.
- The select/vs-screen portraits (group 9000, sprites 0 and 1) were redrawn
  with a bolt arcing across the face, so this variant reads as distinct from
  classic KFM on the character select screen instead of sharing his portrait.

Controls and moves are identical to classic Kung Fu Man - see
chars/kfm/readme.txt for the full move list.
