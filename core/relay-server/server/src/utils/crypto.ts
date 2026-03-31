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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

export async function encryptValue(
  value: any,
  masterKey: string
): Promise<string> {
  const valueString = canonicalJSONStringify(value);
  const encoder = new TextEncoder();
  const keyData = hexToBytes(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM uses 12 bytes
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(valueString)
  );
  
  // Return: iv:encrypted (both as hex)
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encryptedBuffer))}`;
}

export async function decryptValue(encryptedData:  string, masterKey: string): Promise<any> {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const keyData = hexToBytes(masterKey);
  const iv = hexToBytes(ivHex);
  const encrypted = hexToBytes(encryptedHex);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );
  
  const decoder = new TextDecoder();
  const valueString = decoder.decode(decryptedBuffer);
  return JSON.parse(valueString);
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
