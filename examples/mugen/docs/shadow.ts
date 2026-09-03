type Character = {
  pos: { x: number, y: number },
  team: number
}

// NOTE on an earlier, abandoned idea: a ShadowFloat controller once lived
// here, giving KFM himself a small PosSet-based Y hover during states 0/20
// so he'd read as floating. It produced visible jitter with no clearly
// visible hover to show for it, so it was cut - see the "REMOVED" note near
// the top of [Statedef -2] in kfm_shadow/kfm.cns. The floating/ghostly feel
// now lives entirely in the Shadow below, not on KFM's own movement.
//
// Also abandoned: giving KFM's own legs a bound "ghost tail" overlay. A
// static overlay can't track a leg that lifts/crosses per animation frame,
// so it always left a sliver of real leg visible on some idle frames. The
// tail belongs to the Shadow's own sprite instead (see kfm_shadow/gen_stand.py
// in the character's build notes) - KFM's own sprites are fully untouched.

// The Shadow: a permanent helper, not a spawn-on-demand effect. It exists
// bound behind the player from round start (respawned whenever missing -
// see [State -2, Shadow Spawner] in kfm_shadow/kfm.cns) and just alternates
// between idling and attacking; it never vanishes.
// Mirrors [Statedef 9801] (idle) and [Statedef 9802] (attack) in
// kfm_shadow/kfm.cns. The player's own [Statedef 9800] is only a brief
// channeling gesture - the Shadow watches it via a `Parent,` trigger
// redirect rather than the player reaching into the helper.
class TheShadow {

  state: "idle" | "lunge" | "returning" = "idle"

  gestureAnimElemToActivate = 5 // matches Parent,AnimElemTime(5) in State 9801
  lungeStartTicks = 6           // Time = 6 in State 9802 (VelSet + HitDef)
  returnStartTicks = 20         // Time = 20 in State 9802 (VelSet back)
  backToIdleTicks = 31          // Time = 31 in State 9802 (ChangeState -> 9801)

  constructor(private parent: Character, private opponents: Array<Character>){}

  // Called every frame regardless of state - this is what "always visible,
  // not just when active" means: idling is a real animation state, not an
  // absence of one.
  onFrame(parentStateNo: number, parentAnimElemTime: (elem: number) => number){
    if(this.state === "idle"
      && parentStateNo === 9800
      && parentAnimElemTime(this.gestureAnimElemToActivate) === 0
    ){
      this.state = "lunge"
    }
  }

  onOwnFrame(ownTime: number){
    if(this.state === "lunge" && ownTime === this.lungeStartTicks){
      // Lunge forward and throw a single HitDef.
    }
    if(this.state === "lunge" && ownTime === this.returnStartTicks){
      this.state = "returning"
      // Velocity back toward the bound offset.
    }
    if(this.state === "returning" && ownTime === this.backToIdleTicks){
      this.state = "idle" // ChangeState back to 9801, not DestroySelf
    }
  }
}
