
import { readFile, writeFile } from "node:fs/promises";
import { keygen } from "@noble/ed25519";

const SIGNATURE_KEYS_PATH = "/data/signature-keys/matchmaker-keys.json";
async function ensureSignatureKeys(){
  const keys = await readFile(SIGNATURE_KEYS_PATH, "utf8").catch(() => null);
  if(keys) return JSON.parse(keys);
  const { secretKey, publicKey } = await keygen();
  const base64Keys = {
    secretKey: btoa(String.fromCharCode(...new Uint8Array(secretKey))),
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
  }

  await writeFile(SIGNATURE_KEYS_PATH, JSON.stringify(base64Keys));
  return base64Keys;
}

const ENSURANCE = ensureSignatureKeys();

export async function getSignatureKeys(){
  const keys = await ENSURANCE
  return keys;
}

