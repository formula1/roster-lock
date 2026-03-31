/**
 * Snow Move Logic
 *
 * Blankets the field in snow for 3 turns.
 * { damage: 1, weather: { type: "snow", turns: 3 } }
 */

export const moveData = {
  id: 'snow',
  name: 'Snow',
  damage: 1,
  weather: { type: 'snow', turns: 3 },
  description: 'Summons a blizzard that lasts 3 turns.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: { ...moveData.weather } };
}

export function getAnimation() {
  return { type: 'crystallize', color: '#e0f2fe', duration: 700 };
}

export default { data: moveData, execute, getAnimation };

