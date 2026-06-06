import { describe, it, expect, afterEach } from 'vitest';
import type { Task } from '@notiontodoapp/shared';
import { findDueSoon, runDueNotifications } from './scheduler';
import { openDb, type DB } from '../db/index';
import { runMigrations } from '../db/migrate';
import { upsertUserByGoogle } from '../db/users';
import { saveNotionConfig } from '../db/notionConfigs';
import { registerDeviceToken, listAllDeviceTokens } from '../db/deviceTokens';
import { TokenCipher } from '../crypto/tokenCrypto';
import type { NotionService } from '../services/notion/service';
import type { ApnsSender, ApnsResult } from '../apns/sender';

const cipher = new TokenCipher('a'.repeat(64));
const DB_ID = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';

function task(o: Partial<Task>): Task {
  return {
    id: 'id',
    name: 'Úkol',
    status: 'Todo',
    tags: [],
    dueDate: null,
    timeline: null,
    ownerIds: [],
    description: '',
    dependsOnIds: [],
    parentId: null,
    lastEditedTime: '',
    url: '',
    ...o,
  };
}

let db: DB | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

describe('findDueSoon', () => {
  const now = Date.parse('2026-06-10T12:00:00Z');
  it('zahrne termín do 24 h, vynechá Done/bez termínu/po čase/daleko', () => {
    const tasks = [
      task({ id: 'soon', dueDate: '2026-06-10T20:00:00Z' }),
      task({ id: 'done', status: 'Done', dueDate: '2026-06-10T20:00:00Z' }),
      task({ id: 'nodate' }),
      task({ id: 'past', dueDate: '2026-06-09T20:00:00Z' }),
      task({ id: 'far', dueDate: '2026-06-20T20:00:00Z' }),
    ];
    expect(findDueSoon(tasks, now).map((t) => t.id)).toEqual(['soon']);
  });
});

function makeNotion(tasks: Task[]): NotionService {
  return { getTasks: async () => tasks } as unknown as NotionService;
}

function recordingSender(result: ApnsResult): { sender: ApnsSender; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    sender: {
      send: async (token: string): Promise<ApnsResult> => {
        calls.push(token);
        return result;
      },
    },
  };
}

function seedUser(): { db: DB; userId: string } {
  db = openDb(':memory:');
  runMigrations(db);
  const u = upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  saveNotionConfig(db, cipher, {
    userId: u.id,
    token: 'secret',
    databaseId: DB_ID,
    validatedAt: 1,
  });
  registerDeviceToken(db, { userId: u.id, token: 'devtok', platform: 'ios' });
  return { db, userId: u.id };
}

describe('runDueNotifications', () => {
  it('pošle push a označí zařízení', async () => {
    const { db: database } = seedUser();
    const { sender, calls } = recordingSender({ ok: true, status: 200, invalidToken: false });
    const notion = makeNotion([
      task({ id: 't1', name: 'Termín', dueDate: '2026-06-10T20:00:00Z' }),
    ]);

    await runDueNotifications(
      { db: database, cipher, notion, sender },
      Date.parse('2026-06-10T12:00:00Z'),
    );

    expect(calls).toEqual(['devtok']);
    expect(listAllDeviceTokens(database)[0]?.last_notified_at).not.toBeNull();
  });

  it('přeskočí nedávno notifikované zařízení', async () => {
    const { db: database } = seedUser();
    const now = Date.parse('2026-06-10T12:00:00Z');
    // zařízení notifikované před hodinou (< 20 h) → přeskočit
    database.prepare('UPDATE device_tokens SET last_notified_at = ?').run(now - 60 * 60 * 1000);
    const { sender, calls } = recordingSender({ ok: true, status: 200, invalidToken: false });
    const notion = makeNotion([task({ id: 't1', dueDate: '2026-06-10T20:00:00Z' })]);
    await runDueNotifications({ db: database, cipher, notion, sender }, now);
    expect(calls).toEqual([]);
  });

  it('uživatel bez due úkolů nic neposílá', async () => {
    const { db: database } = seedUser();
    const { sender, calls } = recordingSender({ ok: true, status: 200, invalidToken: false });
    const notion = makeNotion([
      task({ id: 't1', status: 'Done', dueDate: '2026-06-10T20:00:00Z' }),
    ]);
    await runDueNotifications(
      { db: database, cipher, notion, sender },
      Date.parse('2026-06-10T12:00:00Z'),
    );
    expect(calls).toEqual([]);
  });

  it('neplatný token smaže', async () => {
    const { db: database } = seedUser();
    const { sender } = recordingSender({ ok: false, status: 410, invalidToken: true });
    const notion = makeNotion([task({ id: 't1', dueDate: '2026-06-10T20:00:00Z' })]);

    await runDueNotifications(
      { db: database, cipher, notion, sender },
      Date.parse('2026-06-10T12:00:00Z'),
    );

    expect(listAllDeviceTokens(database)).toHaveLength(0);
  });
});
