-- ============================================
-- Admin Users Table
-- Stores admin credentials for relay-server management
-- ============================================
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_expires_at TEXT,  -- NULL means no expiration
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_admins_username ON admins(username);

-- Auto-update timestamp trigger
CREATE TRIGGER update_admin_timestamp
AFTER UPDATE ON admins
BEGIN
  UPDATE admins
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- ============================================
-- Matchmakers Table
-- Stores registered matchmaking services
-- ============================================
CREATE TABLE matchmakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK(status IN ('active', 'suspended')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_matchmakers_status ON matchmakers(status);
CREATE INDEX idx_matchmakers_name ON matchmakers(name);
CREATE INDEX idx_matchmakers_public_key ON matchmakers(public_key);

-- Auto-update timestamp trigger
CREATE TRIGGER update_matchmaker_timestamp 
AFTER UPDATE ON matchmakers
BEGIN
  UPDATE matchmakers 
  SET updated_at = datetime('now') 
  WHERE id = NEW.id;
END;

-- ============================================
-- Room Statistics Table
-- Historical record of all rooms
-- ============================================
CREATE TABLE room_stats (
  room_id TEXT PRIMARY KEY,
  matchmaker_id TEXT NOT NULL,

  full_config_hash TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  roster_hash TEXT NOT NULL,
  

  user_ids TEXT NOT NULL,  -- JSON: ["user1", "user2", "user3"]
  user_count INTEGER NOT NULL,

  -- Webhooks
  webhook_room_complete TEXT NOT NULL,  -- URL to notify on room completion`
  webhhook_room_failed TEXT,    -- URL to notify on room failure

  -- Timestamps
  created_at TEXT NOT NULL,
  finished_at TEXT,      -- When all users finished
  
  -- Status tracking
  status TEXT NOT NULL 
    CHECK(status IN ('active', 'completed', 'failed')),
  failed_reason TEXT,     -- If room failed/errored
  failed_user TEXT,       -- If room failed, which user caused it
  
  -- Metrics
  
  FOREIGN KEY (matchmaker_id) REFERENCES matchmakers(id)
);

CREATE INDEX idx_room_stats_matchmaker ON room_stats(matchmaker_id);
CREATE INDEX idx_room_stats_engine ON room_stats(engine_id);
CREATE INDEX idx_room_stats_status ON room_stats(status);
CREATE INDEX idx_room_stats_created ON room_stats(created_at);
CREATE INDEX idx_room_stats_completed ON room_stats(finished_at);

-- ============================================
-- Example Queries
-- ============================================

-- Get active rooms count
-- SELECT COUNT(*) FROM room_stats WHERE status = 'active';

-- Get matchmaker performance
-- SELECT 
--   matchmaker_id,
--   COUNT(*) as total_rooms,
--   AVG(CASE 
--     WHEN completed_at IS NOT NULL 
--     THEN (julianday(completed_at) - julianday(created_at)) * 86400
--   END) as avg_lifetime_seconds
-- FROM room_stats
-- GROUP BY matchmaker_id;

-- Get recent successful rooms
-- SELECT * FROM room_stats 
-- WHERE status = 'completed' 
-- ORDER BY completed_at DESC 
-- LIMIT 10;

-- Example query to get user stats:
-- SELECT 
--   user_id,
--   COUNT(*) as total_games,
--   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_games,
--   AVG(message_count) as avg_messages
-- FROM room_stats, json_each(user_ids) 
-- WHERE json_each.value = 'target_user_id'
-- GROUP BY user_id;
