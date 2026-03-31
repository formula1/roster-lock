
import { JSON_Unknown } from "@match-lock/shared";
import {
  Object as CastObject,
  String as CastString,
} from "runtypes";

import { webcrypto as crypto } from "crypto";
// Generate a random AES-GCM key (256-bit)

export async function encryptJSON(
  originalValue: JSON_Unknown
): Promise<{ key: string, encrypted: { iv: string, ciphertext: string } }> {
  const key = await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
  const text = JSON.stringify(originalValue);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV is recommended for AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(text)
  );
  return {
    key: Buffer.from(await crypto.subtle.exportKey("raw", key)).toString("base64"),
    encrypted: {
      iv: Buffer.from(iv).toString("base64"),
      ciphertext: Buffer.from(ciphertext).toString("base64"),
    }
  };
}

export const CastEncryptedMessage = (
  CastObject({
    iv: CastString,
    ciphertext: CastString,
  }).conform<{ iv: string, ciphertext: string }>()
);

export async function decryptJSON(
  keyString: string, { iv: ivString, ciphertext: ciphertextString }: { iv: string, ciphertext: string }
): Promise<JSON_Unknown> {
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(keyString, "base64").buffer,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
  const iv = new Uint8Array(Buffer.from(ivString, "base64"));
  const ciphertext = Buffer.from(ciphertextString, "base64").buffer;
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext
  );
  const text = new TextDecoder().decode(plaintextBuffer);
  return JSON.parse(text);
}
