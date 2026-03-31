/**
 * Rain Forest Stage Logic
 *
 * A lush tropical rain forest. Starts with rain weather.
 */

export const stageData = {
  id: 'rain-forest',
  name: 'Rain Forest',
  initialWeather: { type: 'rain', turns: 5 },
  maxTurns: 20,
  description: 'A dense, dripping rain forest. Rain boosts water-type moves.',
};

export function onLoad() {
  return {
    weather: { ...stageData.initialWeather, turnsLeft: stageData.initialWeather.turns },
    maxTurns: stageData.maxTurns,
  };
}

export function onTurnStart(gameState) {
  return gameState;
}

export default { data: stageData, onLoad, onTurnStart };

