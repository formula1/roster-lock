-- This service's D1 schema (see wrangler.toml's [[d1_databases]] binding).

-- ============================================
-- Display name counts
-- One row per base display name (lowercased). next_count is the count that
-- will be handed out to the *next* reservation. Reserving is a single
-- atomic UPSERT...RETURNING statement (see src/userStore/displayName.ts),
-- so two concurrent registrations for the same name can never collide on
-- `${name}#${count}` - D1 serializes writes through one primary, so there's
-- no read-then-write race to guard against at the application level.
-- ============================================
CREATE TABLE IF NOT EXISTS display_name_counts (
  name TEXT PRIMARY KEY,
  next_count INTEGER NOT NULL DEFAULT 1
);
