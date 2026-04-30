
import { strToBuffer, uint8ArrayToHex, hexToUint8Array } from "../string";

// Use HMAC

export type SymmetricSignatureKey = string & { readonly __brand: "SignatureKey" };

export const SYMMETRIC_SIGNATURE = {
  generateKey: generateSymmetricKey,
  createSignature: createSymmetricMessageSignature,
  verifySignature:   verifySymmetricMessageSignature,
}

export function generateSymmetricKey(): SymmetricSignatureKey {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return uint8ArrayToHex(bytes) as SymmetricSignatureKey;
}


export async function createSymmetricMessageSignature(
  key: SymmetricSignatureKey,
  message: string
): Promise<string> {
  const keyData = hexToUint8Array(key);
  const messageData = strToBuffer(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  );
  
  return uint8ArrayToHex(new Uint8Array(signatureBuffer))
}


export async function verifySymmetricMessageSignature(
  key: SymmetricSignatureKey,
  message: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = await createSymmetricMessageSignature(key, message);
  
  // Constant-time comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}
