-- Migrace 001: počáteční schéma (jen auth data; úkoly žijí v Notionu).

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  google_id  TEXT UNIQUE NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_users_google_id ON users (google_id);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,   -- SHA-256 hash opaque session tokenu (nikdy plaintext)
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,       -- pro idle timeout / sliding session
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE notion_configs (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  integration_token_encrypted TEXT NOT NULL,    -- AES-256-GCM ciphertext (base64)
  token_iv                    TEXT NOT NULL,     -- náhodný IV (base64), unikátní na zápis
  token_auth_tag              TEXT NOT NULL,     -- GCM auth tag (base64)
  key_version                 INTEGER NOT NULL DEFAULT 1, -- pro rotaci šifrovacího klíče
  database_id                 TEXT NOT NULL,
  validated_at                INTEGER,
  created_at                  INTEGER NOT NULL,
  updated_at                  INTEGER NOT NULL
);
