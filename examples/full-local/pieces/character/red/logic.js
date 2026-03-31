/**
 * Red Character Logic
 *
 * A glass-cannon attacker. Low HP, very high attack, medium speed.
 * Stats: { hp: 1, attack: 3, speed: 2 }
 */

export const characterData = {
  id: 'red',
  name: 'Red',
  color: '#ef4444',
  stats: { hp: 1, attack: 3, speed: 2 },
  moves: ['basic', 'strong', 'rain', 'random-weather', 'remove-weather'],
};

export function calculateDamage(move, target, gameState) {
  return move.damage * characterData.stats.attack;
}

export function onTurnEnd(selfState, gameState) {
  return selfState;
}

export default { data: characterData, calculateDamage, onTurnEnd };

