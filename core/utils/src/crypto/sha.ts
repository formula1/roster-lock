import { strToBuffer, uint8ArrayToHex } from "../string";
import { canonicalJSONStringify } from "../JSON";
import { sha256 } from "@noble/hashes/sha2.js";

export function createShaFromJSON(value: any){
  return createShaFromString(canonicalJSONStringify(value));
}

export async function createShaFromString(value: string){
  return createShaFromBuffer(strToBuffer(value));
}

export async function createShaFromBuffer(value: Uint8Array<ArrayBuffer>){
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    value
  );

  return uint8ArrayToHex(new Uint8Array(hashBuffer));
}

export async function createShaFromTextStream(value: AsyncIterable<string> | Iterable<string>){
  const hasher = sha256.create();
  for await (const chunk of value) {
    hasher.update(strToBuffer(chunk));
  }

  return uint8ArrayToHex(hasher.digest());
}

export async function createShaFromUintStream(value: AsyncIterable<Uint8Array<ArrayBuffer>> | Iterable<Uint8Array<ArrayBuffer>>){
  const hasher = sha256.create();
  for await (const chunk of value) {
    hasher.update(chunk);
  }

  return uint8ArrayToHex(hasher.digest());
}
