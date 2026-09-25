CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matchmakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  registered_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_coordinators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  success_webhook_url TEXT NOT NULL,
  failure_webhook_url TEXT,
  api_key_encrypted TEXT NOT NULL,
  api_key_preview TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_stats (
  room_id TEXT PRIMARY KEY,
  matchmaker_id TEXT NOT NULL REFERENCES matchmakers(id),
  full_config_hash TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  roster_hash TEXT NOT NULL,
  machine_ids TEXT[] NOT NULL,
  machine_count INTEGER NOT NULL,
  coordinator_id TEXT REFERENCES game_coordinators(id),
  created_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  failed_reason TEXT,
  failed_machine TEXT,
  message_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS room_stats_matchmaker_id_idx ON room_stats (matchmaker_id);
