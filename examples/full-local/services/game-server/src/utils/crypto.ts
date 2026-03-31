
import { canonicalJSONStringify } from "./json";


import { verify as ed25519Verify } from "@noble/ed25519";
export async function verifySignature(publicKeyBase64: string, signatureBase64: string, message: any){
  try {
    const publicKey = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const messageBytes = new TextEncoder().encode(canonicalJSONStringify(message));
    
    const isValid = await ed25519Verify(signature, messageBytes, publicKey);

    return isValid;
  }catch(e){
    return false;
  }
}

export async function createHMAC(
  key: string,
  message: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
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
  
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


export async function verifyHMAC(
  key: string,
  message: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = await createHMAC(key, message);
  
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
