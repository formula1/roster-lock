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
