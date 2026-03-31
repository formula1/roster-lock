/**
 * Strong Move Logic
 *
 * A heavy attack. High damage but straightforward.
 * { damage: 6 }
 */

export const moveData = {
  id: 'strong',
  name: 'Strong',
  damage: 6,
  weather: null,
  description: 'A bone-crushing blow that deals massive damage.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: null };
}

export function getAnimation() {
  return { type: 'shockwave', color: '#374151', duration: 600 };
}

export default { data: moveData, execute, getAnimation };

