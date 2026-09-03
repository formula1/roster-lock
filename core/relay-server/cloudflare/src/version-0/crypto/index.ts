import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import { canonicalJSONStringify, JSON_Unknown } from '@match-lock/shared';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface SignedMessage {
  data: JSON_Unknown;
  signature: string;
  publicKey: string;
  timestamp: number;
}

/**
 * Generate a new RSA key pair for signing messages
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return {
    publicKey,
    privateKey
  };
}

/**
 * Sign a message with a private key
 */
export function signMessage(data: JSON_Unknown, privateKey: string, publicKey: string): SignedMessage {
  const timestamp = Date.now();
  const messageToSign = {
    data,
    publicKey,
    timestamp
  };

  const canonicalString = canonicalJSONStringify(messageToSign);
  const sign = createSign('RSA-SHA256');
  sign.update(canonicalString, 'utf8');
  const signature = sign.sign(privateKey, 'base64');

  return {
    data,
    signature,
    publicKey,
    timestamp
  };
}

/**
 * Verify a signed message
 */
export function verifySignedMessage(signedMessage: SignedMessage): boolean {
  try {
    const { data, signature, publicKey, timestamp } = signedMessage;
    
    const messageToVerify = {
      data,
      publicKey,
      timestamp
    };

    const canonicalString = canonicalJSONStringify(messageToVerify);
    const verify = createVerify('RSA-SHA256');
    verify.update(canonicalString, 'utf8');
    
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Extract public key from a signed message and verify it matches
 */
export function extractAndVerifyPublicKey(signedMessage: SignedMessage, expectedPublicKey: string): boolean {
  if (signedMessage.publicKey !== expectedPublicKey) {
    return false;
  }
  return verifySignedMessage(signedMessage);
}

/**
 * Check if a signed message is recent (within the last 5 minutes by default)
 */
export function isMessageRecent(signedMessage: SignedMessage, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const messageAge = now - signedMessage.timestamp;
  return messageAge <= maxAgeMs;
}

/**
 * Verify a signed message with additional checks for freshness and expected public key
 */
export function verifySignedMessageComplete(
  signedMessage: SignedMessage, 
  expectedPublicKey: string,
  maxAgeMs?: number
): boolean {
  // Check if message is recent
  if (!isMessageRecent(signedMessage, maxAgeMs)) {
    console.warn('Message is too old');
    return false;
  }

  // Check if public key matches expected
  if (!extractAndVerifyPublicKey(signedMessage, expectedPublicKey)) {
    console.warn('Public key mismatch or signature verification failed');
    return false;
  }

  return true;
}

export class CryptoError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'CryptoError';
  }
}
