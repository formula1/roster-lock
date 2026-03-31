/**
 * Random Weather Move Logic
 *
 * Deals light damage and sets a random weather condition.
 * { damage: 1, weather: () => { type: WEATHER, turns: number } }
 */

const WEATHER_TYPES = ['sun', 'rain', 'snow'];

export const moveData = {
  id: 'random-weather',
  name: 'Random Weather',
  damage: 1,
  description: 'Calls upon unpredictable forces of nature. Deals 1 damage and sets a random weather.',
};

/**
 * Generates a random weather outcome each time it is called.
 * @returns {{ type: string, turns: number }}
 */
export function getWeather() {
  const type = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  const turns = 2 + Math.floor(Math.random() * 4); // 2–5 turns
  return { type, turns };
}

export function execute(attacker, defender, gameState) {
  return { damage: moveData.damage, weather: getWeather() };
}

export function getAnimation() {
  return { type: 'swirl', color: '#a78bfa', duration: 700 };
}

export default { data: moveData, execute, getWeather, getAnimation };

