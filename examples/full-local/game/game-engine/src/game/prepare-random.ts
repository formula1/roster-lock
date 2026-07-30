import { Room, CommitReveal } from "../room";
import { Random } from "../utils/Random";
import { z } from "zod";

export async function prepareGlobalRandom(room: Room, random: Random): Promise<Record<string, string>> {
  const commitReveal = new CommitReveal(
    room, "rand-seed", ()=>Promise.resolve(random.createSeed()), z.string()
  );
  const seeds = await commitReveal.waitForValues();
  commitReveal.destroy();
  random.seed(seeds);
  return seeds;
}
