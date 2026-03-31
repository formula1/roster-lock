/**
 * Remove Weather Move Logic
 *
 * Clears any active weather condition.
 * { damage: 1, weather: { type: "none", turns: -1 } }
 */

export const moveData = {
  id: 'remove-weather',
  name: 'Remove Weather',
  damage: 1,
  weather: { type: 'none', turns: -1 },
  description: 'Dissipates all weather conditions. Deals 1 damage.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: { ...moveData.weather } };
}

export function getAnimation() {
  return { type: 'dispel', color: '#f3f4f6', duration: 500 };
}

export default { data: moveData, execute, getAnimation };

