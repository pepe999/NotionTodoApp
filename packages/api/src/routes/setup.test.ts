import { describe, it, expect, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { envSchema, type Env } from '../env';
import { buildServer } from '../server';
import { openDb, type DB } from '../db/index';
import { runMigrations } from '../db/migrate';
import { upsertUserByGoogle } from '../db/users';
import { createSession } from '../db/sessions';
import { signSessionJwt } from '../auth/jwt';
import { SESSION_COOKIE } from '../auth/cookies';
import { TokenCipher } from '../crypto/tokenCrypto';
import { getDecryptedNotionConfig } from '../db/notionConfigs';
import { NotionService } from '../services/notion/service';
import { NotionClient } from '../services/notion/client';
import { RateLimitQueue } from '../services/notion/rateQueue';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
};

const DB_ID = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';
const cipher = new TokenCipher('a'.repeat(64));

const validProps = {
  Name: { type: 'title' },
  Status: {
    type: 'select',
    select: {
      options: [{ name: 'Todo' }, { name: 'In Progress' }, { name: 'Review' }, { name: 'Done' }],
    },
  },
  Tags: { type: 'multi_select' },
  Due: { type: 'date' },
  Timeline: { type: 'date' },
  Owner: { type: 'people' },
  Description: { type: 'rich_text' },
  DependsOn: { type: 'relation' },
};

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function setup(fetchImpl: typeof fetch) {
  const env: Env = envSchema.parse(baseEnv);
  db = openDb(':memory:');
  runMigrations(db);
  const notion = new NotionService({
    client: new NotionClient({
      fetchImpl,
      queue: new RateLimitQueue({ concurrency: 5, minIntervalMs: 0 }),
    }),
  });
  app = await buildServer(env, { db, notion, cipher });
  return { app, db, env };
}

function authCookie(database: DB, env: Env): Promise<string> {
  const user = upsertUserByGoogle(database, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  const session = createSession(database, user.id);
  return signSessionJwt(
    env.JWT_SECRET,
    { sid: session.sid, jti: session.rawToken },
    session.absoluteExpiry,
  );
}

describe('setup routes', () => {
  it('vyžaduje autentizaci (401 bez cookie)', async () => {
    const s = await setup(vi.fn() as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/validate',
      payload: { token: 't', databaseId: DB_ID },
    });
    expect(res.statusCode).toBe(401);
  });

  it('/validate vrátí výsledek kontroly sloupců', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ properties: validProps }));
    const s = await setup(fetchMock as unknown as typeof fetch);
    const cookie = await authCookie(s.db, s.env);

    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/validate',
      cookies: { [SESSION_COOKIE]: cookie },
      payload: { token: 'secret_t', databaseId: DB_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(true);
    expect(res.json().columns).toHaveLength(8);
  });

  it('/save uloží zašifrovanou konfiguraci při platné databázi', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ properties: validProps }));
    const s = await setup(fetchMock as unknown as typeof fetch);
    const cookie = await authCookie(s.db, s.env);

    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/save',
      cookies: { [SESSION_COOKIE]: cookie },
      payload: { token: 'secret_save', databaseId: DB_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const userId = (s.db.prepare('SELECT id FROM users').get() as { id: string }).id;
    const stored = getDecryptedNotionConfig(s.db, cipher, userId);
    expect(stored?.token).toBe('secret_save');
    expect(stored?.databaseId).toBe('274d8f1e-2a3b-4c5d-6e7f-8091a2b3c4d5');
  });

  it('/save odmítne neplatnou databázi (400) a nic neuloží', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ properties: { Name: { type: 'title' } } }));
    const s = await setup(fetchMock as unknown as typeof fetch);
    const cookie = await authCookie(s.db, s.env);

    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/save',
      cookies: { [SESSION_COOKIE]: cookie },
      payload: { token: 'secret_x', databaseId: DB_ID },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('InvalidDatabase');
    const count = (s.db.prepare('SELECT COUNT(*) AS n FROM notion_configs').get() as { n: number })
      .n;
    expect(count).toBe(0);
  });

  it('/validate přeloží 401 z Notionu na srozumitelnou chybu', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'unauthorized' }, 401));
    const s = await setup(fetchMock as unknown as typeof fetch);
    const cookie = await authCookie(s.db, s.env);

    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/validate',
      cookies: { [SESSION_COOKIE]: cookie },
      payload: { token: 'bad', databaseId: DB_ID },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('NotionAuth');
  });

  it('odmítne neplatné tělo (Zod 400)', async () => {
    const s = await setup(vi.fn() as unknown as typeof fetch);
    const cookie = await authCookie(s.db, s.env);
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/setup/validate',
      cookies: { [SESSION_COOKIE]: cookie },
      payload: { token: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
