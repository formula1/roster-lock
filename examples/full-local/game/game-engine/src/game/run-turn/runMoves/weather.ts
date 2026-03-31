import { GameState, ModifierState } from "../../../types";
import { WeatherEffect } from "../../../types/move/weather";
import { RANDOM } from "../../../utils/Random";

export function runSetWeather(
  gameState: GameState,
  value: WeatherEffect,
  partConfig: any,
  modifiers: ModifierState,
){
  if(value.value.type === "fixed"){
    modifiers.stage.weather.push({ type: value.value.value, turnsLeft: value.turns });
  } else if(value.value.type === "random"){
    const weather = RANDOM.int(0, value.value.values.length);
    modifiers.stage.weather.push({ type: value.value.values[weather].value, turnsLeft: value.turns });
  } else if(value.value.type === "choose"){
    const weather = partConfig.chosenValue;
    modifiers.stage.weather.push({ type: weather, turnsLeft: value.turns });
  }
}

