
import { Character, GaugeType } from "./character";
export { Character };

export type MoveDescription = {
  player: string,
  characterId: string,
  move: { id: string, config: Record<string, any> },
}

import { RunnableMove } from "./move";

import { Stage, WeatherType } from "./stage";
export type GameState = {
  turnCount: number,
  winners: null | Array<string>,
  stage: Stage,
  players: Record<string, {
    id: string,
  }>,
  characters: Record<string, Character>,
}

export type TurnState = {
  charactersMoved: Set<string>,
  speedPoints: Record<number, {
    speed: number,
    moves: Array<{ description: MoveDescription, move: RunnableMove }>,
  }>
}

export type ModifierState = {
  character: Record<string, Partial<Record<GaugeType, Array<number> >>>,
  stage: {
    weather: Array<{ type: WeatherType, turnsLeft: number }>,
  }
}

