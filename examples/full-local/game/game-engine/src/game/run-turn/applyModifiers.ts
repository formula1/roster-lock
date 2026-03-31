
import { GameState, ModifierState } from "../../types";
import { GaugeType } from "../../types/character";
import { WeatherType } from "../../types/stage";
import { RANDOM } from "../../utils/Random";


export function applyModifiers(gameState: GameState, modifiers: ModifierState): undefined | Array<string> {
  for(const [characterId, gaugeDeltas] of Object.entries(modifiers.character)){
    const character = gameState.characters[characterId];
    if(!character) throw new Error(`Character ${characterId} not found`);
    for(const [gaugeKey, deltas] of Object.entries(gaugeDeltas)){
      const gauge = character[gaugeKey as GaugeType];
      let netDelta = 0;
      for(const moveDelta of deltas) netDelta += moveDelta;
      gauge.current = Math.min(gauge.max, gauge.current + netDelta);
    }
  }

  if(modifiers.stage.weather.length > 0){
    const weathers = modifiers.stage.weather;
    weathers.sort();
    const weather = RANDOM.int(0, weathers.length);
    const newWeather = (()=>{
      const newWeather = weathers[weather];
      if(!newWeather) return { type: WeatherType.None, turnsLeft: -1 };
      if(newWeather.type === WeatherType.None) return { type: WeatherType.None, turnsLeft: -1 };
      return newWeather;
    })();
    gameState.stage.weather = newWeather;
  }

  const livingPlayers: Array<string> = [];
  for(const player of Object.values(gameState.players)){
    for(const character of Object.values(gameState.characters)){
      if(character.ownerPlayer === player.id && character.hp.current > 0){
        livingPlayers.push(player.id);
        break;
      }
    }
  }
  if(livingPlayers.length <= 1){
    gameState.winners = livingPlayers;
    return livingPlayers;
  }
}
