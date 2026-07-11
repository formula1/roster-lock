import { z, ZodType } from "zod";
import { MoveDescription } from "../types";
import { Room } from "../room";


import { CommitReveal } from "../room/CommitReveal";

const moveSchema: ZodType<Array<Omit<MoveDescription, "player">>> = z.array(
  z.object({
    characterId: z.string(),
    move: z.object({ id: z.string(), config: z.any() }).strict(),
  }).strict()
);

export type ProvidedMoves = Array<Omit<MoveDescription, "player">>;

export class MoveSharer extends CommitReveal<ProvidedMoves> {
  constructor(
    room: Room,
    moveRequest: ()=>Promise<ProvidedMoves>
  ){
    super(
      room,
      "move",
      moveRequest,
      moveSchema
    );
  }
}
