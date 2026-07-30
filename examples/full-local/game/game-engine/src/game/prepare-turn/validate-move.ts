import { Character, GameState, MoveDescription, TurnState } from "../../types";

export function validateMove(
  character: Character,
  gameState: GameState,
  turnState: TurnState,
  move: MoveDescription,
){
  const runnableMove = character.moves[move.move.id];
  if(!runnableMove){
    throw new Error(`Move ${move.move.id} not found`);
  }

  const descriptionKeys = Object.keys(move.move.config);
  const runnableMoveKeys = new Set(Object.keys(runnableMove));
  if(descriptionKeys.length !== runnableMoveKeys.size){
    throw new Error(`Move ${move.move.id} expects ${runnableMoveKeys.size} config values, got ${descriptionKeys.length}`);
  }
  for(const key of runnableMoveKeys){
    if(!runnableMoveKeys.has(key)){
      throw new Error(`Move ${move.move.id} has invaid config value ${key}`);
    }
  }
  for(const [key, value] of Object.entries(runnableMove)){
    const config = move.move.config[key];
    const runnableMoveConfig = runnableMove[key];
    switch(runnableMoveConfig.type){
      case "gauge-subtract":
        validateTargets(gameState, turnState, runnableMoveConfig.target, config);
        break;
      case "gauge-add":
        validateTargets(gameState, turnState, runnableMoveConfig.target, config);
        break;
      case "weather":
        validateEnumValue(gameState, turnState, runnableMoveConfig.value, config);
        break;
    }
  }
  return runnableMove;
}

import { TargetFilter, targetConfigSchema, EnumValue, enumValueConfigSchema } from "../../types/move";
function validateTargets(
  gameState: GameState,
  turnState: TurnState,
  targetConfig: TargetFilter,
  config: any,
){
  const parsedConfig = targetConfigSchema.safeParse(config);
  if(!parsedConfig.success){
    throw new Error(`Invalid target config`);
  }
  const { targets } = parsedConfig.data;

  const targetCountConfig = targetConfig.type === "all-except" ? targetConfig.except : targetConfig.targets;
  if(targetCountConfig !== "*"){
    if(Array.isArray(targetCountConfig)){
      const [min, max] = targetCountConfig;
      if(targets.length < min){
        throw new Error(`Move expects at least ${min} targets, got ${targets.length}`);
      }
      if(max !== "*" && targets.length > max){
        throw new Error(`Move expects at most ${max} targets, got ${targets.length}`);
      }
    } else if(targets.length !== targetCountConfig){
      throw new Error(`Move expects ${targetCountConfig} targets, got ${targets.length}`);
    }
  }
  const alreadyTargeted = new Set();
  for(const target of targets){
    const targetCharacter = gameState.characters[target];
    if(!targetCharacter){
      throw new Error(`Target ${target} not found`);
    }
    if(alreadyTargeted.has(target)){
      throw new Error(`Target ${target} targeted multiple times`);
    }
    if(targetCharacter.hp.current <= 0){
      throw new Error(`Target ${target} is dead`);
    }
    alreadyTargeted.add(target);
  }
}


function validateEnumValue(
  gameState: GameState,
  turnState: TurnState,
  enumValue: EnumValue<any>,
  config: any,
){
  if(enumValue.type !== "choose") return;
  const parsedConfig = enumValueConfigSchema.safeParse(config);
  if(!parsedConfig.success){
    throw new Error(`Invalid enum value config`);
  }
  const { chosenValue } = parsedConfig.data;
  if(!enumValue.values.includes(chosenValue)){
    throw new Error(`Invalid enum value ${chosenValue}`);
  }
}
