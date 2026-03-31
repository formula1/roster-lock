/**
 * Weak Move Logic
 *
 * A low-damage attack. Reliable but not powerful.
 * { damage: 1 }
 */

export const moveData = {
  id: 'weak',
  name: 'Weak',
  damage: 1,
  weather: null,
  description: 'A feeble tap. Better than nothing.',
};

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: null };
}

export function getAnimation() {
  return { type: 'flash', color: '#d1d5db', duration: 300 };
}

export default { data: moveData, execute, getAnimation };

