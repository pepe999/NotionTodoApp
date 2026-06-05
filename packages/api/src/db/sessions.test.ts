import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, type DB } from './index';
import { runMigrations } from './migrate';
import { upsertUserByGoogle } from './users';
import {
  createSession,
  findValidSession,
  touchSession,
  deleteSession,
  hashToken,
  IDLE_TTL_MS,
  ABSOLUTE_TTL_MS,
  type SessionRow,
} from './sessions';

let db: DB;
beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
});
afterEach(() => db.close());

const makeUser = () => upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
const getRow = (sid: string) =>
  db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) as SessionRow;

describe('session lifecycle', () => {
  it('vytvoří a najde platnou session', () => {
    const u = makeUser();
    const s = createSession(db, u.id);
    expect(findValidSession(db, s.sid, s.rawToken)?.user_id).toBe(u.id);
  });

  it('odmítne špatný token', () => {
    const u = makeUser();
    const s = createSession(db, u.id);
    expect(findValidSession(db, s.sid, 'wrong')).toBeUndefined();
  });

  it('odmítne idle-expirovanou session', () => {
    const u = makeUser();
    const now = Date.now();
    const s = createSession(db, u.id, now - IDLE_TTL_MS - 1000);
    expect(findValidSession(db, s.sid, s.rawToken, now)).toBeUndefined();
  });

  it('odmítne session přes absolutní strop', () => {
    const u = makeUser();
    const now = Date.now();
    // ruční vložení: idle by byl OK (expires v budoucnu), ale created je za absolutním stropem
    db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('old', u.id, hashToken('tok'), now + 100_000, now, now - ABSOLUTE_TTL_MS - 1000);
    expect(findValidSession(db, 'old', 'tok', now)).toBeUndefined();
  });

  it('touch posune sliding expiraci', () => {
    const u = makeUser();
    const now = Date.now();
    const s = createSession(db, u.id, now);
    const before = getRow(s.sid).expires_at;
    const row = findValidSession(db, s.sid, s.rawToken, now)!;
    touchSession(db, row, now + 2 * 60_000);
    expect(getRow(s.sid).expires_at).toBeGreaterThan(before);
  });

  it('delete odstraní session', () => {
    const u = makeUser();
    const s = createSession(db, u.id);
    deleteSession(db, s.sid);
    expect(findValidSession(db, s.sid, s.rawToken)).toBeUndefined();
  });
});
