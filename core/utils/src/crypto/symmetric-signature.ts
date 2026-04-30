
import { strToBuffer, uint8ArrayToHex, hexToUint8Array } from "../string";

// Use HMAC

export const SYMMETRIC_SIGNATURE = {
  generateKey: generateSymmetricKey,
  createSignature: createSymmetricMessageSignature,
  verifySignature:   verifySymmetricMessageSignature,
}

export function generateSymmetricKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return uint8ArrayToHex(bytes);
}


export async function createSymmetricMessageSignature(
  key: string,
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
  key: string,
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
