import { GameState, MoveDescription, TurnState } from "../../types";
import { ProvidedMoves } from "../MoveSharer";
import { Random } from "../../utils/Random";

import { validatePlayer } from "./validate-player";
import { validateCharacter } from "./validate-character";
import { validateMove } from "./validate-move";

export function prepareTurn(
  gameState: GameState,
  moves: Record<string, ProvidedMoves>,
  random: Random
){
  const turnState: TurnState = {
    charactersMoved: new Set(),
    speedPoints: {},
  };
  for(const [userId, moveData] of Object.entries(moves)){
    for(const moveRaw of moveData){
      const description = { player: userId, characterId: moveRaw.characterId, move: moveRaw.move }
      const moveData = validateMoveDescription(gameState, turnState, description);
      addMoveToSpeedPoint(turnState, description, moveData, random);
    }
  }
  return turnState;
}

function validateMoveDescription(
  gameState: GameState,
  turnState: TurnState,
  move: MoveDescription,
){

  const player = validatePlayer(gameState, turnState, move);
  const character = validateCharacter(gameState, turnState, move);
  const runnableMove = validateMove(character, gameState, turnState, move);

  return { player, character, runnableMove };
}

function addMoveToSpeedPoint(
  { speedPoints }: TurnState,
  description: MoveDescription,
  { character, runnableMove }: ReturnType<typeof validateMoveDescription>,
  random: Random,
){
  const speed = getSpeed(character.speed, random);
  const point = ensureKey(speedPoints, speed, { speed: speed, moves: []})
  point.moves.push({ description, move: runnableMove });
}

function getSpeed(speed: number, random: Random){
  const baseSpeed = Math.floor(speed);
  const randSpeed = speed % 1;
  if(randSpeed === 0) return baseSpeed;
  const additionalSpeed = random.float() < randSpeed ? 1 : 0;
  return baseSpeed + additionalSpeed;
}

function ensureKey<T>(map: Record<number, T>, key: number, defaultValue: T){
  if(key in map) return map[key]!;
  const newValue = defaultValue;
  map[key] = newValue;
  return newValue;
}
