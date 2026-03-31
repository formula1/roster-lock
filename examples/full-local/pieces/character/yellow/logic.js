/**
 * Yellow Character Logic
 *
 * A balanced tank. High HP, decent attack, low speed.
 * Stats: { hp: 3, attack: 2, speed: 1 }
 */

export const characterData = {
  id: 'yellow',
  name: 'Yellow',
  color: '#ffe066',
  stats: { hp: 3, attack: 2, speed: 1 },
  // IDs of moves this character can use (on-demand pieces)
  moves: ['weak', 'basic', 'strong', 'sun', 'remove-weather'],
};

/**
 * Calculate damage dealt to a target.
 * @param {object} move  - move logic data ({ damage, weather? })
 * @param {object} target - defending character state
 * @param {object} gameState
 */
export function calculateDamage(move, target, gameState) {
  return move.damage * characterData.stats.attack;
}

/**
 * Apply end-of-turn effects.
 */
export function onTurnEnd(selfState, gameState) {
  return selfState;
}

export default { data: characterData, calculateDamage, onTurnEnd };

