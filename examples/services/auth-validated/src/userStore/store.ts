import { Env, UserAccount } from "../types";
import { validatePasswordStrength, hashPassword, verifyPassword } from "./password";
import { signJwtToken } from "./jwt";

export async function requestToken(env: Env, email: string): Promise<string> {
  const existingRaw = await env.USER_STORE.get(`user:${email}`);
  const validationToken = crypto.randomUUID();

  let user: UserAccount;
  if (existingRaw) {
    user = JSON.parse(existingRaw);
    user.validationToken = validationToken;
  } else {
    user = {
      id: crypto.randomUUID(),
      email,
      passwordHash: "",
      validated: false,
      validationToken,
    };
  }

  await env.USER_STORE.put(`user:${email}`, JSON.stringify(user));
  return validationToken;
}

export async function validateAndSetPassword(env: Env, email: string, token: string, newPassword: string): Promise<boolean> {
  validatePasswordStrength(newPassword);

  const raw = await env.USER_STORE.get(`user:${email}`);
  if (!raw) return false;

  const user: UserAccount = JSON.parse(raw);
  if (!user.validationToken || user.validationToken !== token) {
    return false;
  }

  user.passwordHash = await hashPassword(newPassword);
  user.validated = true;
  user.validationToken = undefined;
  await env.USER_STORE.put(`user:${email}`, JSON.stringify(user));
  return true;
}

export async function loginUser(env: Env, email: string, rawPassword: string): Promise<string> {
  const raw = await env.USER_STORE.get(`user:${email}`);
  if (!raw) throw new Error("Invalid credentials");

  const user: UserAccount = JSON.parse(raw);
  if (!user.validated || !user.passwordHash) {
    throw new Error("Invalid credentials or user unvalidated");
  }

  const isValid = await verifyPassword(rawPassword, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  return signJwtToken(env, { userId: user.id, email: user.email });
}

export async function updateUser(env: Env, email: string, updates: Partial<UserAccount>): Promise<UserAccount> {
  const raw = await env.USER_STORE.get(`user:${email}`);
  if (!raw) throw new Error("User not found");

  const user: UserAccount = { ...JSON.parse(raw), ...updates };
  await env.USER_STORE.put(`user:${email}`, JSON.stringify(user));
  return user;
}

export async function getUserByEmail(env: Env, email: string): Promise<UserAccount | null> {
  const raw = await env.USER_STORE.get(`user:${email}`);
  return raw ? JSON.parse(raw) : null;
}
