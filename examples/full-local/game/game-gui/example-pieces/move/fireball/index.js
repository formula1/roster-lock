/**
 * Fireball Move
 * 
 * A basic fire-type attack that deals moderate damage.
 * Has a chance to burn the opponent.
 */

export const moveData = {
  id: 'fireball',
  name: 'Fireball',
  type: 'fire',
  category: 'special',
  power: 1.2,
  accuracy: 0.95,
  pp: 15,
  maxPp: 15,
  description: 'Launches a ball of fire at the opponent. May cause burn.',
  effects: {
    burn: {
      chance: 0.1,
      duration: 3
    }
  }
};

/**
 * Execute the move
 */
export function execute(attacker, defender, gameState) {
  const events = [];
  
  // Check accuracy
  const hitRoll = Math.random();
  if (hitRoll > moveData.accuracy) {
    events.push({
      type: 'move_miss',
      move: moveData.name,
      attacker: attacker.id
    });
    return { events, damage: 0 };
  }
  
  // Calculate damage
  const damage = attacker.calculateDamage(moveData, defender);
  
  events.push({
    type: 'move_hit',
    move: moveData.name,
    attacker: attacker.id,
    defender: defender.id,
    damage
  });
  
  // Apply damage
  defender.takeDamage(damage);
  
  // Check for burn effect
  if (moveData.effects.burn) {
    const effectRoll = Math.random();
    if (effectRoll < moveData.effects.burn.chance) {
      defender.applyStatusEffect({
        type: 'burn',
        duration: moveData.effects.burn.duration
      });
      
      events.push({
        type: 'status_applied',
        status: 'burn',
        target: defender.id
      });
    }
  }
  
  return { events, damage };
}

/**
 * Check if move can be used
 */
export function canUse(attacker, defender, gameState) {
  return moveData.pp > 0;
}

/**
 * Get move animation data
 */
export function getAnimation() {
  return {
    type: 'projectile',
    sprite: 'fireball.png',
    duration: 800,
    trajectory: 'arc',
    color: '#ff6600'
  };
}

export default {
  data: moveData,
  execute,
  canUse,
  getAnimation
};

