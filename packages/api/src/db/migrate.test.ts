import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, type DB } from './index';
import { runMigrations } from './migrate';
import { cleanupExpiredSessions } from './sessions';

describe('runMigrations', () => {
  let db: DB;

  beforeEach(() => {
    db = openDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('vytvoří očekávané tabulky', () => {
    runMigrations(db);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'sessions', 'notion_configs']));
  });

  it('je idempotentní (druhý běh nic neaplikuje)', () => {
    const first = runMigrations(db);
    expect(first.length).toBeGreaterThan(0);
    const second = runMigrations(db);
    expect(second).toEqual([]);
  });

  it('vynucuje foreign key CASCADE (smazání usera smaže session)', () => {
    runMigrations(db);
    db.prepare('INSERT INTO users (id, google_id, email, created_at) VALUES (?, ?, ?, ?)').run(
      'u1',
      'g1',
      'a@b.cz',
      Date.now(),
    );
    db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('s1', 'u1', 'h1', Date.now() + 1000, Date.now(), Date.now());
    db.prepare('DELETE FROM users WHERE id = ?').run('u1');
    const count = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(count.n).toBe(0);
  });
});

describe('cleanupExpiredSessions', () => {
  it('smaže jen expirované sessions', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    const now = Date.now();
    db.prepare('INSERT INTO users (id, google_id, email, created_at) VALUES (?, ?, ?, ?)').run(
      'u1',
      'g1',
      'a@b.cz',
      now,
    );
    const insert = db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insert.run('expired', 'u1', 'h1', now - 1000, now, now);
    insert.run('valid', 'u1', 'h2', now + 100_000, now, now);

    const removed = cleanupExpiredSessions(db, now);
    expect(removed).toBe(1);
    const remaining = db.prepare('SELECT id FROM sessions').all() as { id: string }[];
    expect(remaining.map((r) => r.id)).toEqual(['valid']);
    db.close();
  });
});
