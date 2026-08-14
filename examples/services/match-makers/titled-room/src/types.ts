import type { DurableObjectNamespace, D1Database } from "@cloudflare/workers-types";
import type { SymmetricSignatureKey } from "@roster-lock/utils";

export interface Env {
  ROOM_SESSION: DurableObjectNamespace;
  AUTH_SERVICE_URL?: string;
  DB: D1Database;
  // Fixed, deployment-known address of the relay server rooms actually run
  // on once started - never client-supplied (a client could otherwise point
  // participants at a relay server this matchmaker never vouched for).
  RELAY_SERVER_URL?: string;
  // Which game-runner plugins this deployment allows rooms to be created
  // for, what each one's roster config is expected to hash to, and which
  // (if any) game coordinator its rooms use - managed by an admin via
  // src/admin/game-runners.ts against the game_runner_configs D1 table, not
  // an env var (see that file and game-runners.ts).
  //
  // Secret for signing admin JWTs (src/admin/jwt.ts) - separate from
  // MATCHMAKER_SECRET_KEY below, which signs create-room calls to relay
  // rather than authenticating this deployment's own admin.
  JWT_SECRET: SymmetricSignatureKey;
  // Bootstrap credentials for the first admin login (src/admin/index.ts) -
  // mirrors core/relay-server's own admin bootstrap flow exactly. Once an
  // `admins` row exists these are only checked as a fallback.
  INITIAL_ADMIN_USERNAME?: string;
  INITIAL_ADMIN_PASSWORD?: string;
  // This matchmaker's own signing identity, used to prove create-room calls
  // to the relay server come from a legitimate, admin-registered matchmaker
  // (see core/relay-server's matchmakers table). Provisioned as Worker
  // secrets (`wrangler secret put`), not generated-and-persisted-to-disk like
  // examples/multi-game-room's Node-based equivalent - Workers has no local
  // filesystem to persist a generated keypair to across restarts.
  MATCHMAKER_PUBLIC_KEY?: string;
  MATCHMAKER_SECRET_KEY?: string;
}

// Opaque login-identity string handed back by whichever auth backend a
// deployment uses - a real email for examples/services/auth-validated, a
// bare username for examples/services/auth-naive. titled-room never
// interprets or validates its format, only displays/broadcasts it.
export interface PublicUserProfile {
  id: string;
  identifier: string;
  // Included in /auth/verify's real response (see
  // examples/services/auth-validated) even though it's optional here - a
  // brand new account may not have set one yet via /auth/set-display-name.
  displayName?: string;
  playerCount: number;
  publicKey?: string;
  // Only auth-validated's /auth/verify returns this - auth-naive has
  // nothing to validate, so it's absent rather than always-true there.
  validated?: boolean;
}

export interface RoomParticipant {
  userId: string;
  identifier: string;
  // Client-supplied at join/create time (see schema.ts) - distinct from
  // auth identity, since one account can join from more than one machine,
  // and relay-server's room machines are keyed by machineId, not userId.
  machineId: string;
  displayName?: string;
  playerCount: number;
  publicKey?: string;
  ready: boolean;
  joinedAt: string;
}

export interface RoomData {
  id: string;
  title: string;
  hostUserId: string;
  gameRunnerPlugin: string;
  rosterConfig: any;
  gameConfig: any;
  maxPlayers: number;
  minPlayers: number;
  status: "waiting" | "starting" | "started" | "destroyed";
  createdAt: string;
  participants: Record<string, RoomParticipant>;
}
