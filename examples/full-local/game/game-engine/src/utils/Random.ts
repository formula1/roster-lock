

export const RANDOM = {
  createSeed(){
    const array = new Uint8Array(16); // 16 bytes = 128 bits = 32 hex characters
    crypto.getRandomValues(array);
    const randHex = Array.from(array)
      .map(b => b.toString(16).padStart(2, "0"))
      .join(""); // 32-character hex string
    return randHex;
  },

  seed(seed: Record<string, string>){
    const hash = hashSeedRecord(seed);
    this.float = mulberry32(hash);
  },
  release(){
    this.float = emptyFloat;
  },

  float: emptyFloat,

  int(min: number, max?: number){
    if(max === undefined){
      max = min;
      min = 0;
    }
    if(min > max) throw new Error("Min is greater than max");
    return Math.floor(this.float() * (max - min)) + min;
  },

  shuffleImmutable<T>(array: Array<T>): Array<T>{
    const result = [...array];
    this.shuffleMutable(result);
    return result;
  },
  shuffleMutable<T>(array: Array<T>): void{
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },
}

function emptyFloat(): number {
  throw new Error("RANDOM not seeded — call RANDOM.seed() before use");
}

function hashSeedRecord(seedRecord: Record<string, string>): number {
  const combined = Object.keys(seedRecord)
    .sort()
    .map(k => `${k}:${seedRecord[k]}`)
    .join("|");

  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = (Math.imul(hash, 0x01000193) >>> 0);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61) >>> 0;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}
