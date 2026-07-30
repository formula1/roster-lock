
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { SIGNATURE } from "@roster-lock/utils";

const SIGNATURE_KEYS_PATH = "/data/signature-keys/matchmaker-keys.json";
async function ensureSignatureKeys(){
  const keys = await readFile(SIGNATURE_KEYS_PATH, "utf8").catch(() => null);
  if(keys) return JSON.parse(keys);
  const { privateSigningKey, publicVerificationKey } = await SIGNATURE.ASYMMETRIC.generateKeyPair();
  const hexKeys = {
    secretKey: privateSigningKey,
    publicKey: publicVerificationKey,
  }

  await mkdir(path.dirname(SIGNATURE_KEYS_PATH), { recursive: true });
  await writeFile(SIGNATURE_KEYS_PATH, JSON.stringify(hexKeys));
  return hexKeys;
}

const ENSURANCE = ensureSignatureKeys();

export async function getSignatureKeys(){
  const keys = await ENSURANCE
  return keys;
}

