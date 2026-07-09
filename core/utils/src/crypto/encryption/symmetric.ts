import { uint8ArrayToHex, hexToUint8Array, strToBuffer } from "../../string";
import { canonicalJSONStringify } from "../../JSON";

export type SymmetricEncryptionKey = string & { readonly __brand: "EncryptionKey" };


export const ENCRYPT_SYMMETRIC = {
  generateKey: generateSymmetricEncryptionKey,
  encryptValue: encryptValue,
  decryptValue: decryptValue,
}

export function generateSymmetricEncryptionKey(length = 32): SymmetricEncryptionKey {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return uint8ArrayToHex(bytes) as SymmetricEncryptionKey;
}

export async function encryptValue(
  masterKey: SymmetricEncryptionKey,
  value: any,
): Promise<string> {
  const valueString = canonicalJSONStringify(value);
  const keyData = hexToUint8Array(masterKey);
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
    strToBuffer(valueString)
  );

  // Return: iv:encrypted (both as hex)
  return `${uint8ArrayToHex(iv)}:${uint8ArrayToHex(new Uint8Array(encryptedBuffer))}`;
}

export async function decryptValue(
  masterKey: SymmetricEncryptionKey,
  encryptedData:  string,
): Promise<unknown> {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const keyData = hexToUint8Array(masterKey);
  const iv = hexToUint8Array(ivHex);
  const encrypted = hexToUint8Array(encryptedHex);

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
