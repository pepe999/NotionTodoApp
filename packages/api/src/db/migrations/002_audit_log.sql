-- Migrace 002: bezpečnostní audit log (PLAN.md 1.8).
-- user_id je ON DELETE SET NULL – záznamy přežijí výmaz účtu (anonymizované),
-- takže i samotná událost account_delete zůstane (bez vazby na PII).

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  event      TEXT NOT NULL,         -- login | logout | auth_failed | setup_save | account_delete | account_export
  ip         TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);
