
export function randomSlice(
  userInput: Record<string, { selection: string[], seed: number }>,
  config: { slice: number }
){
  const sortedKeys = sortedUsers(userInput);
  const combined = combineValues(sortedKeys, userInput);
  const shuffled = shuffleArray(sortedKeys, combined);
  return shuffled.slice(0, config.slice);
}

function sortedUsers(userInput: Record<string, { selection: string[], seed: number }>){
  return Object.keys(userInput).sort();
}

function combineValues(
  sortedKeys: Array<string>, userInput: Record<string, { selection: string[], seed: number }>,
){
  const combined: Array<string> = [];
  for(const key of sortedKeys){
    combined.push(...userInput[key].selection);
  }
  return combined;
}

import { createHmac } from "node:crypto";

function shuffleArray(sortedKeys: Array<string>, combined: Array<string>){
  const { randomInt } = makeCryptoPRNG(sortedKeys.join(""));
  const array = [...combined];
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Crypto-secure PRNG based on HMAC-SHA256
function makeCryptoPRNG(seed: string) {
  let counter = 0;

  function randomBytes(): Buffer {
    const hmac = createHmac("sha256", seed);
    hmac.update(Buffer.from(counter.toString()));
    counter++;
    return hmac.digest();
  }

  function randomFloat(): number {
    // Take first 8 bytes and turn into a float between 0 and 1
    const bytes = randomBytes();
    const num = bytes.readBigUInt64BE(0);
    return Number(num) / Number(BigInt('0xFFFFFFFFFFFFFFFF'));
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(randomFloat() * (max - min + 1)) + min;
  }

  return { randomFloat, randomInt };
}
