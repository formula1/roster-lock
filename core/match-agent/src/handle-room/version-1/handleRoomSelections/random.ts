
export function createRandomSeed(){
  const array = new Uint8Array(16); // 16 bytes = 128 bits = 32 hex characters
  crypto.getRandomValues(array);
  const randHex = Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join(""); // 32-character hex string
  return randHex;
}
