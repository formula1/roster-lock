import { strToBuffer, uint8ArrayToHex } from "../string";
import { canonicalJSONStringify } from "../JSON";
import { mergeBuffers } from "../buffer";

export function createShaFromJSON(value: any){
  return createShaFromString(canonicalJSONStringify(value));
}

export async function createShaFromString(value: string){
  return createShaFromBuffer(strToBuffer(value));
}

export async function createShaFromBuffer(value: Uint8Array){
  const hashBuffer = await crypto.subtle.digest("SHA-256", value as Uint8Array<ArrayBuffer>);
  return uint8ArrayToHex(new Uint8Array(hashBuffer));
}

export async function createShaFromTextStream(value: AsyncIterable<string> | Iterable<string>){
  const parts: Uint8Array[] = [];
  for await (const chunk of value) parts.push(strToBuffer(chunk));
  return createShaFromBuffer(mergeBuffers(parts));
}

export async function createShaFromUintStream(value: AsyncIterable<Uint8Array> | Iterable<Uint8Array>){
  const parts: Uint8Array[] = [];
  for await (const chunk of value) parts.push(chunk);
  return createShaFromBuffer(mergeBuffers(parts));
}
