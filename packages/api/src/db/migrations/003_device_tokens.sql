-- Migrace 003: APNs device tokeny pro push notifikace (PLAN.md 5.8).
-- ON DELETE CASCADE → smazání účtu odstraní i tokeny (viz 1.8).

CREATE TABLE device_tokens (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token            TEXT UNIQUE NOT NULL,
  platform         TEXT NOT NULL DEFAULT 'ios',
  last_notified_at INTEGER,
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_device_tokens_user_id ON device_tokens (user_id);
