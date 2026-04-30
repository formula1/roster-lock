import { keygen, verify as ed25519Verify, sign as ed25519Sign } from "@noble/ed25519";
import { canonicalJSONStringify } from "../JSON";
import { strToBuffer, uint8ArrayToHex, hexToUint8Array } from "../string";

// Uses ed25519

type PublicKey = string & { readonly __brand: "SignaturePublicKey" };
type PrivateKey = string & { readonly __brand: "SignaturePrivateKey" };

export interface AsymmetricSignatureKeyPair {
  privateSigningKey: PrivateKey;
  publicVerificationKey: PublicKey;
}

export const ASYMMETRIC_SIGNATURE = {
  generateKeyPair: generateAsymmetricSignatureKeyPair,
  createSignature: createAsymmetricMessageSignature,
  verifySignature: verifyAsymmetricMessageSignature
};

export async function generateAsymmetricSignatureKeyPair(): Promise<AsymmetricSignatureKeyPair> {
  const keyPair = await keygen();
  return {
    privateSigningKey: uint8ArrayToHex(new Uint8Array(keyPair.secretKey)) as PrivateKey,
    publicVerificationKey: uint8ArrayToHex(new Uint8Array(keyPair.publicKey)) as PublicKey,
  };
}

export async function createAsymmetricMessageSignature(
  privateSigningKey: PrivateKey,
  message: any,
): Promise<string> {
  const privateKey = hexToUint8Array(privateSigningKey);
  const messageBytes = strToBuffer(canonicalJSONStringify(message));
  const signature = await ed25519Sign(messageBytes, privateKey);
  return uint8ArrayToHex(signature);
}

export async function verifyAsymmetricMessageSignature(
  publicVerificationKey: PublicKey,
  signature: string,
  message: any,
): Promise<boolean> {
  try {
    const publicKey = hexToUint8Array(publicVerificationKey);
    const signatureBuffer = hexToUint8Array(signature);

    const messageBytes = strToBuffer(canonicalJSONStringify(message));
    
    const isValid = await ed25519Verify(signatureBuffer, messageBytes, publicKey);

    return isValid;
  }catch(e){
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
