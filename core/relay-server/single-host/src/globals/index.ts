import { join } from "path";
import { SymmetricEncryptionKey, SymmetricSignatureKey } from "@roster-lock/utils";

// src/globals -> src -> single-host -> relay-server
const RELAY_SERVER_DIR = join(__dirname, "../../..");

// Every spot that used to read `c.env.X` on relay-server-cf reads through
// here instead - one place to see what env vars this service needs, and a
// seam for a future config file/secret store without touching call sites.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function enumEnv<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (!value) return fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${name}: "${value}". Expected one of: ${allowed.join(", ")}`);
  }
  return value as T;
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

export type MessageQueueVersion = "memory" | "redis";
const MESSAGE_QUEUE_VERSIONS: readonly MessageQueueVersion[] = ["memory", "redis"];

// Explicit switch for which IMessageQueue implementation to run, rather
// than inferring it from whether REDIS_URL happens to be set - "memory" is
// a single process with no cross-instance relaying; "redis" points every
// instance of a horizontally-scaled deployment at the same redis (see
// REDIS_URL below) so they can hand messages off to whichever instance is
// controlling a room/holding a user's connection.
export function getMessageQueueVersion(): MessageQueueVersion {
  return enumEnv("MESSAGE_QUEUE_VERSION", MESSAGE_QUEUE_VERSIONS, "memory");
}

// Only required when MESSAGE_QUEUE_VERSION=redis.
export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || undefined;
}

// Identifies this process as an IMessageQueue claim owner (e.g. "which
// server is controlling room X") and as the target of per-connection
// channels (e.g. "which server is holding machine Y's socket"). Stable for
// the process's lifetime; override with SERVER_ID for a deployment that
// wants a predictable id (e.g. a pod name) instead of a random one.
const generatedServerId = crypto.randomUUID();
export function getServerId(): string {
  return process.env.SERVER_ID || generatedServerId;
}

// Defaults to the @roster-lock/relay-client build sitting next to this
// package in the workspace (core/relay-server/client-admin/dist). Overridable for
// container images that copy the built client somewhere else.
export function getClientDistDir(): string {
  return process.env.CLIENT_DIST_DIR || join(RELAY_SERVER_DIR, "client-admin/dist");
}

export type ModelsVersion = "memory" | "postgres";
const MODELS_VERSIONS: readonly ModelsVersion[] = ["memory", "postgres"];

// Explicit switch for which model implementations (admins, matchmakers,
// game coordinators, room stats) to run, same pattern as
// MESSAGE_QUEUE_VERSION. "memory" has no persistence across restarts;
// "postgres" is backed by DATABASE_URL below, with schema migrations
// applied automatically on startup.
export function getModelsVersion(): ModelsVersion {
  return enumEnv("MODELS_VERSION", MODELS_VERSIONS, "memory");
}

// Only required when MODELS_VERSION=postgres.
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

// Most free-tier hosted providers (Neon, Supabase, ...) require SSL and
// present a publicly-trusted cert, so this defaults on; turn it off for a
// local/dev postgres that doesn't speak TLS.
export function getDatabaseSsl(): boolean {
  return process.env.DATABASE_SSL !== "false";
}
