import { strToBuffer, uint8ArrayToHex } from "../string";
import { canonicalJSONStringify } from "../JSON";
import { sha256 } from "@noble/hashes/sha2.js";

export async function createShaFromValue(value: any){
  const content = strToBuffer(canonicalJSONStringify(value));

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    content
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

export async function createShaFromUintStream(value: AsyncIterable<string> | Iterable<string>){
  const hasher = sha256.create();
  for await (const chunk of value) {
    hasher.update(strToBuffer(chunk));
  }

  return uint8ArrayToHex(hasher.digest());
}
