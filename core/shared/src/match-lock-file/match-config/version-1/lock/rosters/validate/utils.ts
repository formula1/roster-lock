
export function validateSha256(value: string){
  // Must be exactly 64 hex chars (0–9, a–f, case‑insensitive)
  if (/^[0-9a-f]{64}$/i.test(value)) return;
  throw new Error(`${value} is not a valid SHA-256 (64-char hex)`);
}

export function validateURL(value: string){
  if(!URL.canParse(value)) throw new Error(`${value} is not a valid URL`);
  const url = new URL(value);
  if(!["https:"].includes(url.protocol)) throw new Error(`${value} is not a valid https`);
}
