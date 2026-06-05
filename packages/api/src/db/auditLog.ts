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
