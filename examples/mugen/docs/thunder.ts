
type Character = {
  pos: { x: number, y: number },
  team: number
}


class ThunderBolt {

  state: "charge" | "delay" | "active" = "charge"

  maxChargeValue = 120
  chargeValue = 0

  maxDelayValue = -1;
  delayValue = 0;

  maxActiveValue = 30;
  activeValue = 0

  constructor(
    private self: Character, private characters: Array<Character>
  ){}  

  onFrame(){
    switch(this.state){
      case "charge": return this.handleChargeFrame();
      case "delay": return this.handleDelayFrame();
      case "active": return this.handleActiveFrame();
    }
  }

  initializeCharge(){
    this.state = "charge";
    this.chargeValue = 0;
  }

  handleChargeFrame(){
    this.chargeValue += 1;
    if(this.chargeValue !== this.maxChargeValue){
      // Make the charge effects look stronger the more charge there is
      this.updateChargeAuraFX()
    } else {
      this.initializeFireDelay()
    }
  }

  initializeFireDelay(){
    this.state = "delay";
    // Delay fire from half a second to up to 3 seconds
    this.maxDelayValue = 30 + Math.floor(Math.random() * 150)
    this.delayValue = 0;
  }

  handleDelayFrame(){
    this.delayValue += 1;
    if(this.delayValue !== this.maxDelayValue){
      // the first half second should be the creation of a thunder ball
      // after that we just want to loop an effect
      this.updateDelayFX();
    } else {
      this.initializeActive();

    }
  }

  initializeActive(){
    this.state = "active";
    this.activeValue = 0;
  }

  handleActiveFrame(){
    this.activeValue += 1;
    if(this.activeValue !== this.maxActiveValue){
      // When the thunder ball is about to be active we want to update the graphics
      // This is to give the opposing player half a second to react to it
      this.updateActiveDelayFX();
    } else {
      // When the active pause is finished, we want to trigger the projectile
      this.runThunderBallProjectile()
      this.initializeCharge()
    }
  }

  runThunderBallProjectile(){
    // First lets find the closest opponent
    let closestOpponent: undefined | { char: Character, dist: number } = void 0;
    for(const char of this.characters){
      if(char.team === this.self.team) continue;
      const dist = calculateDistance(this.self, char);
      if(!closestOpponent){
        closestOpponent = { char, dist}
      } else if(dist < closestOpponent.dist){
        closestOpponent = { char, dist}
      }
    }
    if(!closestOpponent){
      // If there are no more opponent
      // Make the thunder ball explode without harming anyone
      // This thunderball graphic are independent from the charge counter
      return this.fizzleThunderBall();
    }
    // When we find an opponent we want to create a thunder graphic from the ball to the opponent
    // Probably needs to be rotated to the correct angle from the ball to the opponents position
    // The thunder strike should be near instant
    // This thunderball graphic are independent from the charge counter
    // We also want the charged thunderball to dissappear
    this.strikeOpponent(closestOpponent)
  }
}

function calculateDistance(a: Character, b: Character){
  const r = Math.sqrt(
    Math.pow(a.pos.x - b.pos.x, 2) + Math.pow(a.pos.y - b.pos.y, 2)
  )
  return r;
}
