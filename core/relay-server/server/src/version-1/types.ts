import { D1Database, DurableObjectNamespace, Fetcher } from "@cloudflare/workers-types";

// Environment bindings
export interface Env {
  ROOM: DurableObjectNamespace;
  DB: D1Database;
  CLIENT_ASSETS: Fetcher;  // Static assets binding for serving the React client
  ENVIRONMENT: string;
  JWT_SECRET: string;  // Secret for signing JWTs
  INITIAL_ADMIN_USERNAME?: string;  // Optional: initial admin username (default: 'admin')
  INITIAL_ADMIN_PASSWORD?: string;  // Optional: initial admin password for bootstrap
}


// Room Creation
export interface RoomConfig {
  matchmakerId: string;
  roomId: string;
  rosterConfigHash: string;
  users: RoomUser[];
}

export interface RoomUser {
  userId: string;
  publicKey: string;
  displayName: string;
}
