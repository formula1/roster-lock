
export function validateSha256(value: string){
  // Must be exactly 64 hex chars (0–9, a–f, case‑insensitive)
  if (/^[0-9a-f]{64}$/i.test(value)) return;
  throw new Error(`${value} is not a valid SHA-256 (64-char hex)`);
}

export function validateURL(value: string){
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${value} is not a valid URL`);
  }
  if(url.protocol === "http:" && url.hostname === "localhost") return;
  if(!["https:"].includes(url.protocol)) throw new Error(`${value} is not a valid https`);
}
