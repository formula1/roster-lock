/**
 * Mountain Stage Logic
 *
 * A snowy mountain peak. Starts with snow weather.
 */

export const stageData = {
  id: 'mountain',
  name: 'Mountain',
  initialWeather: { type: 'snow', turns: 5 },
  maxTurns: 20,
  description: 'A frigid mountain summit blanketed in snow. Snow slows certain fighters.',
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

