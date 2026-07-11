
import { GameState, MoveDescription, TurnState } from "../../types";

export function validatePlayer(
  gameState: GameState,
  turnState: TurnState,
  move: MoveDescription,
){
  const player = gameState.players[move.player];
  if(!player){
    throw new Error(`Player ${move.player} not found`);
  }
  return player;
}
