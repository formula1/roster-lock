import { keygen, verify as ed25519Verify, sign as ed25519Sign } from "@noble/ed25519";
import { canonicalJSONStringify } from "./json";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

function strToBuffer(str: string) {
  return new TextEncoder().encode(str);
}

export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await keygen();
  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(keyPair.publicKey))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(keyPair.secretKey))),
  };
}

export async function signMessage(
  privateKeyBase64: string,
  message: any,
): Promise<string> {
  const privateKey = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  const messageBytes = strToBuffer(canonicalJSONStringify(message));
  const signature = await ed25519Sign(messageBytes, privateKey);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifySignature(
  publicKeyBase64: string,
  signatureBase64: string,
  message: any,
): Promise<boolean> {
  try {
    const publicKey = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const messageBytes = strToBuffer(canonicalJSONStringify(message));
    
    const isValid = await ed25519Verify(signature, messageBytes, publicKey);

    return isValid;
  }catch(e){
    return false;
  }
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
