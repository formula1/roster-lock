import { Room, CommitReveal } from "../room";
import { RANDOM } from "../utils/Random";
import { z } from "zod";

export async function prepareGlobalRandom(room: Room){
  const commitReveal = new CommitReveal(
    room, "rand-seed", ()=>Promise.resolve(RANDOM.createSeed()), z.string()
  );
  const seeds = await commitReveal.waitForValues();
  commitReveal.destroy();
  RANDOM.seed(seeds);
}
