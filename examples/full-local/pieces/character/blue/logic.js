/**
 * Blue Character Logic
 *
 * A speedster with medium HP and low attack.
 * Stats: { hp: 2, attack: 1, speed: 3 }
 */

export const characterData = {
  id: 'blue',
  name: 'Blue',
  color: '#3b82f6',
  stats: { hp: 2, attack: 1, speed: 3 },
  moves: ['weak', 'basic', 'snow', 'rain', 'random-weather'],
};

export function calculateDamage(move, target, gameState) {
  return move.damage * characterData.stats.attack;
}

export function onTurnEnd(selfState, gameState) {
  return selfState;
}

export default { data: characterData, calculateDamage, onTurnEnd };

