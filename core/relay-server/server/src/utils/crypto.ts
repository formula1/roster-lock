import { canonicalJSONStringify } from "./json";


// Helper to convert string to ArrayBuffer
export function strToBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer as ArrayBuffer;
}

// Helper to convert Uint8Array to ArrayBuffer
export function uint8ToBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

export async function verifySignature(publicKeyBase64: string, signatureBase64: string, message: any){
  const publicKeyJwk = JSON.parse(atob(publicKeyBase64));
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
  const content = strToBuffer(canonicalJSONStringify(message));

  const isValid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    signature.buffer as ArrayBuffer,
    content
  );

  return isValid;
}


export async function createSha(value: any){
  const content = strToBuffer(canonicalJSONStringify(value));
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    content
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

