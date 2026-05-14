import { canonicalJSONStringify } from "../../JSON";
import { strToBuffer, uint8ArrayToHex, hexToUint8Array } from "../../string";
import { mergeBuffers } from "../../buffer";

type PublicKey = string & { readonly __brand: "SignaturePublicKey" };
type PrivateKey = string & { readonly __brand: "SignaturePrivateKey" };

export interface AsymmetricSignatureKeyPair {
  privateSigningKey: PrivateKey;
  publicVerificationKey: PublicKey;
}

export const SIGNATURE_ASYMMETRIC = {
  generateKeyPair: generateAsymmetricSignatureKeyPair,
  createSignature: createAsymmetricMessageSignature,
  verifySignature: verifyAsymmetricMessageSignature
};

// ASN.1 DER wrappers for raw 32-byte Ed25519 keys (RFC 8410)
const PKCS8_HEADER = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);
const SPKI_HEADER = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
  0x70, 0x03, 0x21, 0x00,
]);

const ED25519 = { name: "Ed25519" } as const;

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function importPrivKey(raw: Uint8Array) {
  return crypto.subtle.importKey("pkcs8", mergeBuffers([PKCS8_HEADER, raw]), ED25519, false, ["sign"]);
}

async function importPubKey(raw: Uint8Array) {
  return crypto.subtle.importKey("spki", mergeBuffers([SPKI_HEADER, raw]), ED25519, false, ["verify"]);
}

export async function generateAsymmetricSignatureKeyPair(): Promise<AsymmetricSignatureKeyPair> {
  const keyPair = await crypto.subtle.generateKey(ED25519, true, ["sign", "verify"]);
  if (!("privateKey" in keyPair)) throw new Error("Ed25519 generateKey did not return a key pair");
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey) as { d: string };
  const pubJwk  = await crypto.subtle.exportKey("jwk", keyPair.publicKey)  as { x: string };
  return {
    privateSigningKey:     uint8ArrayToHex(base64urlToBytes(privJwk.d)) as PrivateKey,
    publicVerificationKey: uint8ArrayToHex(base64urlToBytes(pubJwk.x))  as PublicKey,
  };
}

export async function createAsymmetricMessageSignature(
  privateSigningKey: PrivateKey,
  message: any,
): Promise<string> {
  const privKey = await importPrivKey(hexToUint8Array(privateSigningKey));
  const messageBytes = strToBuffer(canonicalJSONStringify(message));
  const signature = await crypto.subtle.sign(ED25519, privKey, messageBytes);
  return uint8ArrayToHex(new Uint8Array(signature));
}

export async function verifyAsymmetricMessageSignature(
  publicVerificationKey: PublicKey,
  signature: string,
  message: any,
): Promise<boolean> {
  try {
    const pubKey = await importPubKey(hexToUint8Array(publicVerificationKey));
    const messageBytes = strToBuffer(canonicalJSONStringify(message));
    return await crypto.subtle.verify(ED25519, pubKey, hexToUint8Array(signature), messageBytes);
  } catch(e) {
    return false;
  }
}

/*
// Types Test
(async()=>{
  const keys = await ASYMMETRIC_SIGNATURE.generateKeyPair();
  const value = { hello: "world" };
  const signature = await ASYMMETRIC_SIGNATURE.createSignature(
    keys.privateSigningKey, value
  )
  const valid = await ASYMMETRIC_SIGNATURE.verifySignature(
    keys.publicVerificationKey, signature, value
  )
})()
*/
