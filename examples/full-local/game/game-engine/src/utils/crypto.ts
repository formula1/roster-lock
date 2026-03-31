import { canonicalJSONStringify } from './JSON';

type Base64Global = typeof globalThis & {
  atob?: (data: string) => string;
  btoa?: (data: string) => string;
};

type CryptoLike = {
  subtle: {
    generateKey(
      algorithm: { name: 'AES-GCM'; length: number },
      extractable: boolean,
      keyUsages: string[],
    ): Promise<unknown>;
    exportKey(format: 'raw', key: unknown): Promise<ArrayBuffer>;
    importKey(
      format: 'raw',
      keyData: Uint8Array,
      algorithm: { name: 'AES-GCM' },
      extractable: boolean,
      keyUsages: string[],
    ): Promise<unknown>;
    encrypt(
      algorithm: { name: 'AES-GCM'; iv: Uint8Array },
      key: unknown,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
    decrypt(
      algorithm: { name: 'AES-GCM'; iv: Uint8Array },
      key: unknown,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
  };
  getRandomValues<T extends Uint8Array>(array: T): T;
};

function getCrypto() {
  const crypto = (globalThis as typeof globalThis & { crypto?: CryptoLike }).crypto;
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return crypto;
}

function getBtoa(): (data: string) => string {
  const { btoa } = globalThis as Base64Global;
  if (typeof btoa !== 'function') {
    throw new Error('btoa is not available in this environment.');
  }
  return btoa;
}

function getAtob(): (data: string) => string {
  const { atob } = globalThis as Base64Global;
  if (typeof atob !== 'function') {
    throw new Error('atob is not available in this environment.');
  }
  return atob;
}

function bytesToBase64(bytes: Uint8Array): string {
  const btoa = getBtoa();
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = getAtob()(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export interface EncryptedJSONValue {
  iv: string;
  ciphertext: string;
}

export async function encryptJSON<T>(
  originalValue: T,
): Promise<{ key: string; encrypted: EncryptedJSONValue }> {
  const crypto = getCrypto();
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(canonicalJSONStringify(originalValue));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plaintext,
  ));

  return {
    key: bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key))),
    encrypted: {
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    },
  };
}

export async function decryptJSON<T = unknown>(
  { key, encrypted }: { key: string; encrypted: EncryptedJSONValue },
): Promise<T> {
  const crypto = getCrypto();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(key),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(encrypted.iv),
    },
    cryptoKey,
    base64ToBytes(encrypted.ciphertext),
  );

  return JSON.parse(new TextDecoder().decode(plaintextBuffer)) as T;
}
