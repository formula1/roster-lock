/**
 * Rain Move Logic
 *
 * Conjures a downpour that lasts 3 turns.
 * { damage: 1, weather: { type: "rain", turns: 3 } }
 */

export const moveData = {
  id: 'rain',
  name: 'Rain',
  damage: 1,
  weather: { type: 'rain', turns: 3 },
  description: 'Calls down rain for 3 turns.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: { ...moveData.weather } };
}

export function getAnimation() {
  return { type: 'drip', color: '#60a5fa', duration: 600 };
}

export default { data: moveData, execute, getAnimation };

