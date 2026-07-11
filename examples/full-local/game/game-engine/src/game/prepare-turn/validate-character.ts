import { GameState, MoveDescription, TurnState } from "../../types";

export function validateCharacter(
  gameState: GameState,
  turnState: TurnState,
  move: MoveDescription,
){
  if(turnState.charactersMoved.has(move.characterId)){
    throw new Error(`Character ${move.characterId} moved twice`);
  }
  turnState.charactersMoved.add(move.characterId);
  const character = gameState.characters[move.characterId];
  if(!character){
    throw new Error(`Character ${move.characterId} not found for player ${move.player}`);
  }
  if(character.controllerPlayer !== move.player){
    throw new Error(`Character ${move.characterId} is not controlled by player ${move.player}`);
  }
  if(character.hp.current <= 0){
    throw new Error(`Character ${move.characterId} is dead`);
  }
  if(!(move.move.id in character.moves)){
    throw new Error(`Move ${move.move.id} not found for character ${move.characterId}`);
  }
  return character;
}
