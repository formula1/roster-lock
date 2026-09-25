import jwt from "jsonwebtoken";
import { Env } from "../types";

export const getSecret = (env: Env) => env.JWT_SECRET || "default-auth-secret-key";

export function signJwtToken(env: Env, payload: { userId: string; email: string }): string {
  return jwt.sign(payload, getSecret(env), { expiresIn: "24h" });
}

export function verifyJwtToken(env: Env, token: string): { userId: string; email: string } {
  return jwt.verify(token, getSecret(env)) as { userId: string; email: string };
}
