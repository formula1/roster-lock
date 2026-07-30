
import type { RunnableMove } from "./move";

type Gauge = {
  current: number,
  max: number,
}

export enum GaugeType {
  Hp = "hp",
  Stamina = "stamina"
};

export type Character = {
  id: string
  ownerPlayer: string,
  controllerPlayer: string,
  [GaugeType.Hp]: Gauge,
  [GaugeType.Stamina]: Gauge,

  speed: number,
  attack: number,
  // Keyed by move id, from this character's own selection — not a global move pool.
  moves: Record<string, RunnableMove>,
};
