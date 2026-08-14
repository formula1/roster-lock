
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { SIGNATURE } from "@roster-lock/utils";

const SIGNATURE_KEYS_PATH = "/data/signature-keys/room-match-maker-keys.json";
async function ensureSignatureKeys(){
  const keys = await readFile(SIGNATURE_KEYS_PATH, "utf8").catch(() => null);
  if(keys) return JSON.parse(keys);
  const { privateSigningKey, publicVerificationKey } = await SIGNATURE.ASYMMETRIC.generateKeyPair();
  const hexKeys = {
    secretKey: privateSigningKey,
    publicKey: publicVerificationKey,
  };

  await mkdir(path.dirname(SIGNATURE_KEYS_PATH), { recursive: true });
  await writeFile(SIGNATURE_KEYS_PATH, JSON.stringify(hexKeys));
  return hexKeys;
}

const ENSURANCE = ensureSignatureKeys();

// This is the keypair the Room Match Maker registers with the Relay Room
// service's own matchmaker registry (core/relay-server's matchmaker.ts admin
// route) - it's what lets create-room calls below be trusted as coming from
// a legitimate matchmaker, same as examples/full-local/services/matchmaking.
export async function getSignatureKeys(){
  return ENSURANCE;
}
