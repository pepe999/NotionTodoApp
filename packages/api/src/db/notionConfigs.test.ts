import { describe, it, expect, afterEach } from 'vitest';
import { openDb, type DB } from './index';
import { runMigrations } from './migrate';
import { upsertUserByGoogle } from './users';
import { TokenCipher } from '../crypto/tokenCrypto';
import { saveNotionConfig, getNotionConfig, getDecryptedNotionConfig } from './notionConfigs';

const cipher = new TokenCipher('a'.repeat(64));
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

describe('notionConfigs', () => {
  it('uloží token ZAŠIFROVANĚ (ne plaintext) a dešifruje zpět', () => {
    const { db: database, userId } = freshUser();
    saveNotionConfig(database, cipher, {
      userId,
      token: 'secret_plaintext',
      databaseId: 'db-1',
      validatedAt: 123,
    });

    const row = getNotionConfig(database, userId);
    expect(row?.integration_token_encrypted).not.toContain('secret_plaintext');
    expect(row?.database_id).toBe('db-1');
    expect(row?.validated_at).toBe(123);

    const decrypted = getDecryptedNotionConfig(database, cipher, userId);
    expect(decrypted).toEqual({ token: 'secret_plaintext', databaseId: 'db-1' });
  });

  it('upsert přepíše existující konfiguraci (unikát per user)', () => {
    const { db: database, userId } = freshUser();
    saveNotionConfig(database, cipher, { userId, token: 't1', databaseId: 'db-1', validatedAt: 1 });
    saveNotionConfig(database, cipher, { userId, token: 't2', databaseId: 'db-2', validatedAt: 2 });

    const all = database.prepare('SELECT COUNT(*) AS n FROM notion_configs').get() as { n: number };
    expect(all.n).toBe(1);
    expect(getDecryptedNotionConfig(database, cipher, userId)).toEqual({
      token: 't2',
      databaseId: 'db-2',
    });
  });

  it('vrátí undefined pro neznámého uživatele', () => {
    const { db: database } = freshUser();
    expect(getNotionConfig(database, 'nope')).toBeUndefined();
    expect(getDecryptedNotionConfig(database, cipher, 'nope')).toBeUndefined();
  });
});
