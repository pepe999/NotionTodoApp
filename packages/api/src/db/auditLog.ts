import { randomUUID } from 'node:crypto';
import type { DB } from './index';

/** Typy bezpečnostních událostí (PLAN.md 1.8). */
export type AuditEvent =
  | 'login'
  | 'logout'
  | 'auth_failed'
  | 'setup_save'
  | 'account_delete'
  | 'account_export';

export interface AuditRow {
  id: string;
  user_id: string | null;
  event: AuditEvent;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface AuditParams {
  userId?: string | null;
  event: AuditEvent;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/** Zaznamená bezpečnostní událost. Chyby zápisu nesmí shodit request – volej v try/catch na hranici. */
export function recordAudit(db: DB, params: AuditParams, now: number = Date.now()): void {
  db.prepare(
    'INSERT INTO audit_log (id, user_id, event, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    randomUUID(),
    params.userId ?? null,
    params.event,
    params.ip ?? null,
    params.userAgent ?? null,
    now,
  );
}

/** Audit záznamy uživatele (pro GDPR export), nejnovější první. */
export function getAuditLogForUser(db: DB, userId: string): AuditRow[] {
  return db
    .prepare('SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as AuditRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Retence audit logu – obsahuje PII (IP, user-agent), viz revize PLAN.md 2026-06-11. */
export const AUDIT_RETENTION_MS = 90 * DAY_MS;

/** Smaže audit záznamy starší než retence. Vrací počet odstraněných. */
export function cleanupOldAuditLogs(db: DB, now: number = Date.now()): number {
  return db.prepare('DELETE FROM audit_log WHERE created_at < ?').run(now - AUDIT_RETENTION_MS)
    .changes;
}

/**
 * Periodický úklid audit logu (výchozí: každou hodinu, stejně jako sessions).
 * Timer je `unref`-ovaný, aby neblokoval ukončení procesu. Vrací stop funkci.
 */
export function startAuditLogCleanup(db: DB, intervalMs: number = 60 * 60 * 1000): () => void {
  cleanupOldAuditLogs(db);
  const timer = setInterval(() => cleanupOldAuditLogs(db), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
