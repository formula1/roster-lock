import { FinalState, GameState, MoveDescription, TurnState } from "../../types";
import { ProvidedMoves } from "../MoveSharer";
import { RANDOM } from "../../utils/Random";

import { validatePlayer } from "./validate-player";
import { validateCharacter } from "./validate-character";
import { validateMove } from "./validate-move";

export function prepareTurn(
  finalState: FinalState,
  gameState: GameState,
  moves: Record<string, ProvidedMoves>
){
  const turnState: TurnState = {
    charactersMoved: new Set(),
    speedPoints: {},
  };
  for(const [userId, moveData] of Object.entries(moves)){
    for(const moveRaw of moveData){
      const description = { player: userId, characterId: moveRaw.characterId, move: moveRaw.move }
      const moveData = validateMoveDescription(finalState, gameState, turnState, description);
      addMoveToSpeedPoint(turnState, description, moveData);
    }
  }
  return turnState;
}

function validateMoveDescription(
  finalState: FinalState,
  gameState: GameState,
  turnState: TurnState,
  move: MoveDescription,
){

  const player = validatePlayer(finalState, gameState, turnState, move);
  const character = validateCharacter(finalState, gameState, turnState, move);
  const runnableMove = validateMove(finalState, gameState, turnState, move);

  return { player, character, runnableMove };
}

function addMoveToSpeedPoint(
  { speedPoints }: TurnState,
  description: MoveDescription,
  { character, runnableMove }: ReturnType<typeof validateMoveDescription>,
){
  const speed = getSpeed(character.speed);
  const point = ensureKey(speedPoints, speed, { speed: speed, moves: []})
  point.moves.push({ description, move: runnableMove });
}

function getSpeed(speed: number){
  const baseSpeed = Math.floor(speed);
  const randSpeed = speed % 1;
  if(randSpeed === 0) return baseSpeed;
  const additionalSpeed = RANDOM.float() < randSpeed ? 1 : 0;
  return baseSpeed + additionalSpeed;
}

function ensureKey<T>(map: Record<number, T>, key: number, defaultValue: T){
  if(key in map) return map[key]!;
  const newValue = defaultValue;
  map[key] = newValue;
  return newValue;
}
