import { SymmetricEncryptionKey, SymmetricSignatureKey } from "@roster-lock/utils";

// Every spot that used to read `c.env.X` on relay-server-cf reads through
// here instead - one place to see what env vars this service needs, and a
// seam for a future config file/secret store without touching call sites.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getGameCoordinatorEncryptionKey(): SymmetricEncryptionKey {
  return requireEnv("GAME_COORDINATOR_ENCRYPTION_KEY") as SymmetricEncryptionKey;
}

export function getJWTSecret(): SymmetricSignatureKey {
  return requireEnv("JWT_SECRET") as SymmetricSignatureKey;
}

// Optional: bootstraps a single admin on first /admin/login with these
// credentials, same as relay-server-cf's INITIAL_ADMIN_USERNAME/PASSWORD.
// Unset in production once a real admin exists.
export function getInitialAdminUsername(): string | undefined {
  return process.env.INITIAL_ADMIN_USERNAME || undefined;
}

export function getInitialAdminPassword(): string | undefined {
  return process.env.INITIAL_ADMIN_PASSWORD || undefined;
}

export function getPort(): number {
  return Number.parseInt(process.env.PORT || "8787", 10);
}
