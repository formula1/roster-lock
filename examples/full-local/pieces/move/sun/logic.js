/**
 * Sun Move Logic
 *
 * Scorching attack that sets sunny weather for 3 turns.
 * { damage: 1, weather: { type: "sun", turns: 3 } }
 */

export const moveData = {
  id: 'sun',
  name: 'Sun',
  damage: 1,
  weather: { type: 'sun', turns: 3 },
  description: 'Summons blazing sunlight for 3 turns.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: { ...moveData.weather } };
}

export function getAnimation() {
  return { type: 'burst', color: '#ffe066', duration: 600 };
}

export default { data: moveData, execute, getAnimation };

