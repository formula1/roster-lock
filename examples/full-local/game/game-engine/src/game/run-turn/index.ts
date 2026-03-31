import { FinalState, GameState, TurnState } from "../../types";
import { runMoves } from "./runMoves";
import { applyModifiers } from "./applyModifiers";

export function* runTurn(
  finalState: FinalState,
  gameState: GameState,
  { speedPoints }: TurnState,
){
  // We sort the speed points in descending order
  // 5 speed is before 4 speed
  const speedPointValues = Object.keys(speedPoints).map(Number).sort((a, b)=>(b-a));
  for(const point of speedPointValues){
    const moves = speedPoints[point]!.moves;
    const modifiers = runMoves(gameState, speedPoints[point]!);
    const winCondition = applyModifiers(gameState, modifiers);
    yield { point, moves, modifiers, gameState };
    if(winCondition) return;
  }
}
