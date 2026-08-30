import type { DurableObjectNamespace, D1Database, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  ROOM_SESSION: DurableObjectNamespace;
  AUTH_SERVICE_URL?: string;
  DB: D1Database;
  // Static assets binding for serving titled-room/client's built React app
  // (see wrangler.toml's [assets] and index.ts's catch-all route) - mirrors
  // core/relay-server/cloudflare's CLIENT_ASSETS binding for client-admin.
  CLIENT_ASSETS: Fetcher;
  // Fixed, deployment-known address of the relay server rooms actually run
  // on once started - never client-supplied (a client could otherwise point
  // participants at a relay server this matchmaker never vouched for). Used
  // for this worker's own server-to-server calls to the relay (relay-client.ts).
  RELAY_SERVER_URL?: string;
  // What RoomSession broadcasts to clients as the relay to connect to -
  // separate from RELAY_SERVER_URL because the two can differ (a
  // docker-internal hostname this worker reaches directly vs. a
  // localhost/public address a browser client needs instead - see
  // examples/mugen's internal-urls.env for exactly this split). Falls back
  // to RELAY_SERVER_URL when unset, for deployments where they're the same.
  PUBLIC_RELAY_SERVER_URL?: string;
  // This matchmaker's own signing identity, used to prove create-room calls
  // to the relay server come from a legitimate, admin-registered matchmaker
  // (see core/relay-server's matchmakers table). Provisioned as Worker
  // secrets (`wrangler secret put`), not generated-and-persisted-to-disk like
  // examples/multi-game-room's Node-based equivalent - Workers has no local
  // filesystem to persist a generated keypair to across restarts.
  MATCHMAKER_PUBLIC_KEY?: string;
  MATCHMAKER_SECRET_KEY?: string;
  // ikemen-go's game coordinator (rendezvous address for direct-tcp netplay)
  // - deployment-configured env vars, not admin-managed (see game-launchers.ts's
  // gameCoordinatorFor). Names match examples/mugen's own
  // IKEMEN_COORDINATOR_TCP_HOST/PORT (see internal-urls.env) rather than a
  // separate GAME_COORDINATOR_HOST/PORT pair, since this deployment already
  // has those. Unset entirely means "no coordinator" (false); setting
  // GAME_COORDINATOR_ID requires both HOST and PORT too.
  GAME_COORDINATOR_ID?: string;
  IKEMEN_COORDINATOR_TCP_HOST?: string;
  IKEMEN_COORDINATOR_TCP_PORT?: string;
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
  gameLauncherPlugin: string;
  rosterConfig: any;
  gameConfig: any;
  maxPlayers: number;
  minPlayers: number;
  status: "waiting" | "starting" | "started" | "destroyed";
  createdAt: string;
  participants: Record<string, RoomParticipant>;
}
