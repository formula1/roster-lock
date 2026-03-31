import seedrandom from 'seedrandom';

export class MultiSeedPRNG {
  private rng: seedrandom.PRNG;

  constructor(seeds: string[]) {
    // Combine seeds deterministically
    const combinedSeed = seeds.join('|');
    this.rng = seedrandom(combinedSeed);
  }

  nextFloat(): number {
    return this.rng();
  }

  nextInt(min: number, max: number): number {
    if (min > max) throw new Error("Min is greater than max");
    return Math.floor(this.nextFloat() * (max - min)) + min;
  }

  // For array shuffling (Fisher-Yates)
  shuffleIndexes(length: number, startOffset: number = 0): number[] {
    if (length < 0) throw new Error("Length is negative");
    const result = Array.from({ length }, (_, i) => i + startOffset);
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
