import { Env, UserAccount } from "../types";
import { validatePasswordStrength, hashPassword, verifyPassword } from "./password";
import { signJwtToken } from "./jwt";

// No email verification step - an account is active the moment it's
// registered. This service exists purely for fast local testing, where
// remembering a password reset/validation flow is friction, not safety.
export async function registerUser(env: Env, username: string, password: string): Promise<void> {
  const existingRaw = await env.USER_STORE.get(`user:${username}`);
  if (existingRaw) throw new Error("Username already taken");

  validatePasswordStrength(password);

  const user: UserAccount = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password),
  };
  await env.USER_STORE.put(`user:${username}`, JSON.stringify(user));
}

export async function loginUser(env: Env, username: string, rawPassword: string): Promise<string> {
  const raw = await env.USER_STORE.get(`user:${username}`);
  if (!raw) throw new Error("Invalid credentials");

  const user: UserAccount = JSON.parse(raw);
  const isValid = await verifyPassword(rawPassword, user.passwordHash);
  if (!isValid) throw new Error("Invalid credentials");

  return signJwtToken(env, { userId: user.id, username: user.username });
}

export async function updateUser(env: Env, username: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  const raw = await env.USER_STORE.get(`user:${username}`);
  if (!raw) throw new Error("User not found");

  const user: UserAccount = { ...JSON.parse(raw), ...updates };
  await env.USER_STORE.put(`user:${username}`, JSON.stringify(user));
  return user;
}

export async function getUserByUsername(env: Env, username: string): Promise<UserAccount | null> {
  const raw = await env.USER_STORE.get(`user:${username}`);
  return raw ? JSON.parse(raw) : null;
}
