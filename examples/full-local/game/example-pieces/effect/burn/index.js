/**
 * Burn Status Effect
 * 
 * Causes the affected character to take damage each turn.
 * Reduces attack power.
 */

export const effectData = {
  id: 'burn',
  name: 'Burn',
  type: 'status',
  icon: '🔥',
  description: 'Takes damage each turn and reduces attack power.',
  damagePerTurn: 0.1, // 10% of max HP
  attackReduction: 0.5 // 50% attack reduction
};

/**
 * Apply the effect when first inflicted
 */
export function onApply(target, source, gameState) {
  return {
    type: 'effect_applied',
    effect: effectData.name,
    target: target.id,
    message: `${target.name} was burned!`
  };
}

/**
 * Process the effect at the start of each turn
 */
export function onTurnStart(target, gameState) {
  const maxHp = target.stats.baseStats.hp;
  const damage = Math.floor(maxHp * effectData.damagePerTurn);
  
  target.takeDamage(damage);
  
  return {
    type: 'effect_damage',
    effect: effectData.name,
    target: target.id,
    damage,
    message: `${target.name} is hurt by its burn!`
  };
}

/**
 * Modify attack damage when character has burn
 */
export function modifyAttack(attacker, baseDamage, gameState) {
  return Math.floor(baseDamage * effectData.attackReduction);
}

/**
 * Check if effect should be removed
 */
export function shouldRemove(target, gameState) {
  // Burn lasts until cured or battle ends
  return false;
}

/**
 * Remove the effect
 */
export function onRemove(target, gameState) {
  return {
    type: 'effect_removed',
    effect: effectData.name,
    target: target.id,
    message: `${target.name}'s burn was healed!`
  };
}

/**
 * Get visual effect data for rendering
 */
export function getVisualEffect() {
  return {
    type: 'particle',
    particles: [
      {
        sprite: 'flame-particle.png',
        count: 10,
        lifetime: 1000,
        speed: 2,
        color: '#ff6600'
      }
    ],
    animation: 'flicker',
    duration: -1 // Continuous
  };
}

export default {
  data: effectData,
  onApply,
  onTurnStart,
  modifyAttack,
  shouldRemove,
  onRemove,
  getVisualEffect
};

