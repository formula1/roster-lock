import { GameState, ModifierState } from "../../../types";
import { TargetFilter } from "../../../types/move";
import { GaugeModifierAdd, GaugeModifierSubtract } from "../../../types/move/gauge-modifiers";

export function runGaugeSubtract(
  gameState: GameState,
  value: GaugeModifierSubtract,
  partConfig: any,
  modifiers: ModifierState,
){
  for(const target of getAppliedCharacters(gameState, value.target, partConfig)){
    const modifiedChar = ensureValue(modifiers.character, target, {});
    const modifiedGauge = ensureValue(modifiedChar, value.stat, [] as Array<number>);
    modifiedGauge.push(-value.value);
  }
}

export function runGaugeAdd(
  gameState: GameState,
  value: GaugeModifierAdd,
  partConfig: any,
  modifiers: ModifierState,
){
  for(const target of getAppliedCharacters(gameState, value.target, partConfig)){
    const modifiedChar = ensureValue(modifiers.character, target, {});
    const modifiedGauge = ensureValue(modifiedChar, value.stat, [] as Array<number>);
    modifiedGauge.push(value.value);
  }
}

function ensureValue<T>(map: Record<string, T>, key: string, defaultValue: T){
  if(key in map) return map[key]!;
  map[key] = defaultValue;
  return defaultValue;
}

function getAppliedCharacters(
  gameState: GameState,
  targetConfig: TargetFilter,
  partConfig: any,
){
  const targets = (()=>{
    const targetIds = partConfig.targets as Array<string>;
    if(targetConfig.type === "explicit") return targetIds;
    const allTargets = Object.keys(gameState.characters);
    return allTargets.filter((target) => !targetIds.includes(target));
  })();
  targets.sort((a, b)=>a.localeCompare(b));
  return targets;
}
