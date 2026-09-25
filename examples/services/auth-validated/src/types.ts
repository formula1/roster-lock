import type { KVNamespace, D1Database } from "@cloudflare/workers-types";

export interface Env {
  USER_STORE: KVNamespace;
  DB: D1Database;
  JWT_SECRET?: string;
}

export interface UserAccount {
  id: string;
  displayName?: string;
  email: string;
  passwordHash: string;
  validated: boolean;
  validationToken?: string;
  publicKey?: string;
  // How many local players/controllers this user's machine brings to a room
  // (see titled-room's PublicUserProfile/RoomParticipant, which read this
  // straight off /auth/verify). Defaults to 1 player when unset - see
  // /auth/verify below.
  playerCount?: number;
}
