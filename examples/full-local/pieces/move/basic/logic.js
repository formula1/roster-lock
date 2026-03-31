/**
 * Basic Move Logic
 *
 * A standard attack. Solid damage.
 * { damage: 3 }
 */

export const moveData = {
  id: 'basic',
  name: 'Basic',
  damage: 3,
  weather: null,
  description: 'A solid, reliable strike.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: null };
}

export function getAnimation() {
  return { type: 'flash', color: '#6b7280', duration: 400 };
}

export default { data: moveData, execute, getAnimation };

