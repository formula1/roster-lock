import { Env } from '../../types';
import { strToBuffer, uint8ToBuffer } from "../../../utils/crypto";

// JWT payload structure
export interface JWTPayload {
  sub: string;  // username
  iat: number;  // issued at
  exp: number;  // expiration
}

// Create JWT token
export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number = 24 * 60 * 60  // Default 24 hours
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(fullPayload)).replace(/=/g, '');
  const message = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    strToBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, strToBuffer(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '');

  return `${message}.${signatureB64}`;
}

// Validate JWT and return payload (or null if invalid)
export async function validateJWT(
  token: string,
  secret: string,
  db: Env['DB']
): Promise<(JWTPayload & { id: string }) | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      strToBuffer(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Pad base64 if needed
    const padded = signatureB64 + '='.repeat((4 - signatureB64.length % 4) % 4);
    const signature = new Uint8Array(atob(padded).split('').map(c => c.charCodeAt(0)));

    const valid = await crypto.subtle.verify('HMAC', key, uint8ToBuffer(signature), strToBuffer(message));
    if (!valid) return null;

    // Parse payload
    const paddedPayload = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
    const payload: JWTPayload = JSON.parse(atob(paddedPayload));

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify user still exists in database
    const user = await db.prepare('SELECT id FROM admins WHERE username = ?')
      .bind(payload.sub).first<{ id: string }>();
    if (!user) return null;

    return { sub: payload.sub, iat: payload.iat, exp: payload.exp, id: user.id };
  } catch {
    return null;
  }
}

