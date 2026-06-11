import { describe, it, expect, afterEach } from 'vitest';
import { openDb, type DB } from './index';
import { runMigrations } from './migrate';
import { upsertUserByGoogle, deleteUser } from './users';
import {
  recordAudit,
  getAuditLogForUser,
  cleanupOldAuditLogs,
  AUDIT_RETENTION_MS,
} from './auditLog';

let db: DB | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function freshUser(): { db: DB; userId: string } {
  db = openDb(':memory:');
  runMigrations(db);
  const user = upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  return { db, userId: user.id };
}

describe('auditLog', () => {
  it('zaznamená a načte události uživatele (nejnovější první)', () => {
    const { db: database, userId } = freshUser();
    recordAudit(database, { userId, event: 'login', ip: '1.2.3.4', userAgent: 'UA' }, 1000);
    recordAudit(database, { userId, event: 'setup_save', ip: '1.2.3.4' }, 2000);

    const rows = getAuditLogForUser(database, userId);
    expect(rows.map((r) => r.event)).toEqual(['setup_save', 'login']);
    expect(rows[0]?.ip).toBe('1.2.3.4');
  });

  it('migrace 002 vytvoří tabulku audit_log', () => {
    const { db: database } = freshUser();
    const t = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
      .get();
    expect(t).toBeDefined();
  });

  it('výmaz uživatele anonymizuje audit (ON DELETE SET NULL)', () => {
    const { db: database, userId } = freshUser();
    recordAudit(database, { userId, event: 'account_delete' }, 1000);
    deleteUser(database, userId);
    const remaining = database.prepare('SELECT user_id, event FROM audit_log').all() as {
      user_id: string | null;
      event: string;
    }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.user_id).toBeNull(); // anonymizováno
    expect(remaining[0]?.event).toBe('account_delete');
  });

  it('retence smaže záznamy starší 90 dní, novější ponechá', () => {
    const { db: database, userId } = freshUser();
    const now = Date.now();
    recordAudit(database, { userId, event: 'login' }, now - AUDIT_RETENTION_MS - 1000);
    recordAudit(database, { userId, event: 'logout' }, now - 1000);

    const removed = cleanupOldAuditLogs(database, now);
    expect(removed).toBe(1);
    expect(getAuditLogForUser(database, userId).map((r) => r.event)).toEqual(['logout']);
  });
});
