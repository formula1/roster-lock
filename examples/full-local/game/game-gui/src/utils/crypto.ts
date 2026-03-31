import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
}

export async function signMessage(privateKey: string, message: string): Promise<string> {
  const secretKey = decodeBase64(privateKey);
  const messageBytes = encodeUTF8(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return encodeBase64(signature);
}

export async function verifySignature(
  publicKey: string,
  message: string,
  signature: string
): Promise<boolean> {
  const publicKeyBytes = decodeBase64(publicKey);
  const messageBytes = encodeUTF8(message);
  const signatureBytes = decodeBase64(signature);
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}

