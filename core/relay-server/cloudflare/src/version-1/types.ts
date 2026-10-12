import { D1Database, DurableObjectNamespace, Fetcher } from "@cloudflare/workers-types";
import { SymmetricSignatureKey } from "@roster-lock/utils";

// Environment bindings
export interface Env {
  ROOM: DurableObjectNamespace;
  DB: D1Database;
  CLIENT_ASSETS: Fetcher;  // Static assets binding for serving the React client
  ENVIRONMENT: string;

  JWT_SECRET: SymmetricSignatureKey;  // Secret for signing JWTs
  GAME_COORDINATOR_ENCRYPTION_KEY: string;

  INITIAL_ADMIN_USERNAME?: string;  // Optional: initial admin username (default: 'admin')
  INITIAL_ADMIN_PASSWORD?: string;  // Optional: initial admin password for bootstrap
}

export type { RoomConfig, RoomMachine } from "@roster-lock/types";
