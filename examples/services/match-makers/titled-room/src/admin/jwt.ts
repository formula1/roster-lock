import { Env } from "../types";
import { SIGNATURE, SymmetricSignatureKey, hexToUint8Array, uint8ArrayToHex } from "@roster-lock/utils";

// JWT payload structure
export interface JWTPayload {
  sub: string;  // username
  iat: number;  // issued at
  exp: number;  // expiration
}

// Create JWT token
export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: SymmetricSignatureKey,
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

  const signatureHex = await SIGNATURE.SYMMETRIC.createSignature(secret, message);
  const signatureB64 = btoa(String.fromCharCode(...hexToUint8Array(signatureHex))).replace(/=/g, '');

  return `${message}.${signatureB64}`;
}

// Validate JWT and return payload (or null if invalid)
export async function validateJWT(
  token: string,
  secret: SymmetricSignatureKey,
  db: Env['DB']
): Promise<(JWTPayload & { id: string }) | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    // Pad base64 if needed
    const padded = signatureB64 + '='.repeat((4 - signatureB64.length % 4) % 4);
    const signatureHex = uint8ArrayToHex(new Uint8Array(atob(padded).split('').map(c => c.charCodeAt(0))));

    const valid = await SIGNATURE.SYMMETRIC.verifySignature(secret, message, signatureHex);
    if (!valid) return null;

    // Parse payload
    const paddedPayload = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
    const payload: JWTPayload = JSON.parse(atob(paddedPayload));

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify admin still exists in database
    const admin = await db.prepare('SELECT id FROM admins WHERE username = ?')
      .bind(payload.sub).first<{ id: string }>();
    if (!admin) return null;

    return { sub: payload.sub, iat: payload.iat, exp: payload.exp, id: admin.id };
  } catch {
    return null;
  }
}
