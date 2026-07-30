import { GameState, TurnState, ModifierState } from "../../../types";
import { Random } from "../../../utils/Random";
import { runGaugeSubtract, runGaugeAdd } from "./gauge";
import { runSetWeather } from "./weather";

export function runMoves(gameState: GameState, moves: TurnState["speedPoints"][number], random: Random){
  const modifiers: ModifierState = { character: {}, stage: { weather: [] } };

  // We need to process the moves in a predictable order for random reasons
  // We're expecting only one move per character
  // So we sort the moves by character id
  const sortedMoves = moves.moves.sort((a, b)=>{
    return a.description.characterId.localeCompare(b.description.characterId);
  })
  for(const move of sortedMoves){
    const character = gameState.characters[move.description.characterId];
    if(!character) throw new Error(`Character ${move.description.characterId} not found`);
    // Character has died on a previous move
    if(character.hp.current <= 0) continue;
    for(const [key, value] of Object.entries(move.move)){
      const partConfig = move.description.move.config[key];
      switch(value.type){
        case "gauge-subtract":
          runGaugeSubtract(gameState, value, partConfig, modifiers);
          break;
        case "gauge-add":
          runGaugeAdd(gameState, value, partConfig, modifiers);
          break;
        case "weather":
          runSetWeather(gameState, value, partConfig, modifiers, random);
          break;
      }
    }
  }
  return modifiers;
}
