-- This service's D1 schema (see wrangler.toml's [[d1_databases]] binding).

-- ============================================
-- Room index
-- Durable Objects (RoomSession) have no "list all instances" API, so a room
-- can't be browsed/listed from the DO alone - this table is a queryable
-- index maintained by the Hono route layer (src/index.ts) alongside each
-- create/join/start/destroy call. The DO's own storage stays the source of
-- truth for room business logic (capacity, readiness, etc); this table is a
-- cache for browsing only.
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  game_runner_plugin TEXT NOT NULL,
  roster_config_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  max_players INTEGER NOT NULL,
  min_players INTEGER NOT NULL,
  participant_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================
-- Admins
-- Mirrors core/relay-server's own admins table/bootstrap flow: the first
-- successful login with INITIAL_ADMIN_USERNAME/PASSWORD (see src/admin/login)
-- creates this row; every login after that is checked against it instead.
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_expires_at TEXT,
  created_at TEXT NOT NULL
);

-- ============================================
-- Game runner configs
-- Which game-runner plugins this deployment allows rooms to be created for,
-- managed by an admin (see src/admin/game-runners.ts) rather than by
-- redeploying with different env vars. Replaces the old ALLOWED_GAME_RUNNERS/
-- GAME_COORDINATORS env vars entirely.
--
-- coordinator_id/host/port are all NULL together for a plugin that
-- deliberately has no coordinator (the admin-route equivalent of
-- RoomConfig.coordinatorId === false); all three are set together otherwise.
-- ============================================
CREATE TABLE IF NOT EXISTS game_runner_configs (
  plugin_name TEXT PRIMARY KEY,
  engine_sha TEXT NOT NULL,
  coordinator_id TEXT,
  coordinator_host TEXT,
  coordinator_port INTEGER,
  updated_at TEXT NOT NULL
);
