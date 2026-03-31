/**
 * Beach Stage Logic
 *
 * A sunny beach arena. Starts with sun weather.
 */

export const stageData = {
  id: 'beach',
  name: 'Beach',
  initialWeather: { type: 'sun', turns: 5 },
  maxTurns: 20,
  description: 'A bright sandy beach under blazing sun. The sun boosts certain moves.',
};

/**
 * Called once when the stage is loaded.
 * Returns initial game-state additions specific to this stage.
 */
export function onLoad() {
  return {
    weather: { ...stageData.initialWeather, turnsLeft: stageData.initialWeather.turns },
    maxTurns: stageData.maxTurns,
  };
}

/**
 * Called at the start of each turn.
 * @param {object} gameState
 */
export function onTurnStart(gameState) {
  // Nothing extra for beach beyond normal weather tick
  return gameState;
}

export default { data: stageData, onLoad, onTurnStart };

