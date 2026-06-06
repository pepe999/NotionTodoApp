import { describe, it, expect, afterEach } from 'vitest';
import { openDb, type DB } from './index';
import { runMigrations } from './migrate';
import { upsertUserByGoogle, deleteUser } from './users';
import {
  registerDeviceToken,
  removeDeviceToken,
  listDeviceTokensForUser,
  listAllDeviceTokens,
  markDeviceNotified,
} from './deviceTokens';

let db: DB | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

function freshUser(): { db: DB; userId: string } {
  db = openDb(':memory:');
  runMigrations(db);
  const u = upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  return { db, userId: u.id };
}

describe('deviceTokens', () => {
  it('register je upsert dle tokenu', () => {
    const { db: database, userId } = freshUser();
    registerDeviceToken(database, { userId, token: 'tok1', platform: 'ios' });
    registerDeviceToken(database, { userId, token: 'tok1', platform: 'ios' });
    expect(listDeviceTokensForUser(database, userId)).toHaveLength(1);
  });

  it('list, mark a remove', () => {
    const { db: database, userId } = freshUser();
    registerDeviceToken(database, { userId, token: 'tok1', platform: 'ios' });
    const [row] = listAllDeviceTokens(database);
    expect(row?.last_notified_at).toBeNull();
    markDeviceNotified(database, row!.id, 1234);
    expect(listAllDeviceTokens(database)[0]?.last_notified_at).toBe(1234);
    removeDeviceToken(database, 'tok1');
    expect(listAllDeviceTokens(database)).toHaveLength(0);
  });

  it('výmaz uživatele odstraní tokeny (CASCADE)', () => {
    const { db: database, userId } = freshUser();
    registerDeviceToken(database, { userId, token: 'tok1', platform: 'ios' });
    deleteUser(database, userId);
    expect(listAllDeviceTokens(database)).toHaveLength(0);
  });
});
