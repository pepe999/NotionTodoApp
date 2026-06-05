import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { envSchema, type Env } from './env';
import { buildServer } from './server';
import { openDb, type DB } from './db/index';
import { runMigrations } from './db/migrate';
import { upsertUserByGoogle } from './db/users';
import { createSession } from './db/sessions';
import { signSessionJwt } from './auth/jwt';
import { SESSION_COOKIE } from './auth/cookies';
import { TokenCipher } from './crypto/tokenCrypto';
import { saveNotionConfig } from './db/notionConfigs';
import { NotionService } from './services/notion/service';
import { NotionClient } from './services/notion/client';
import { RateLimitQueue } from './services/notion/rateQueue';

/**
 * E2E (PLAN.md 2.3): skutečně naslouchající server + reálné HTTP požadavky
 * (undici/fetch přes socket, ne fastify.inject). Notion je mockovaný.
 */
const DB_ID = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';
const cipher = new TokenCipher('a'.repeat(64));

let app: FastifyInstance;
let db: DB;
let base: string;
let cookie: string;

function notionPage(id: string, name: string, parentId?: string) {
  return {
    id,
    url: `https://notion.so/${id}`,
    last_edited_time: '2026-06-01T00:00:00.000Z',
    properties: {
      Name: { type: 'title', title: [{ plain_text: name }] },
      Status: { type: 'select', select: { name: 'Todo' } },
      'Parent item': { type: 'relation', relation: parentId ? [{ id: parentId }] : [] },
    },
  };
}

/** Mock Notion fetch: query → list, pages → vytvořená/upravená stránka. */
function notionFetch(): typeof fetch {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    let body: unknown;
    if (u.includes('/query')) {
      body = { results: [notionPage('p1', 'Existing')], has_more: false, next_cursor: null };
    } else if (u.includes('/pages') && method === 'POST') {
      body = notionPage('new-task', 'E2E úkol');
    } else {
      body = notionPage('p1', 'E2E úkol');
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

beforeAll(async () => {
  const env: Env = envSchema.parse({
    NODE_ENV: 'test',
    JWT_SECRET: 'x'.repeat(40),
    NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
  });
  db = openDb(':memory:');
  runMigrations(db);
  const notion = new NotionService({
    client: new NotionClient({
      fetchImpl: notionFetch(),
      queue: new RateLimitQueue({ concurrency: 5, minIntervalMs: 0 }),
    }),
  });
  app = await buildServer(env, { db, notion, cipher });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;

  const user = upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  const session = createSession(db, user.id);
  cookie = `${SESSION_COOKIE}=${await signSessionJwt(env.JWT_SECRET, { sid: session.sid, jti: session.rawToken }, session.absoluteExpiry)}`;
  saveNotionConfig(db, cipher, {
    userId: user.id,
    token: 'secret_t',
    databaseId: DB_ID,
    validatedAt: 1,
  });
});

afterAll(async () => {
  await app.close();
  db.close();
});

describe('E2E (reálný socket)', () => {
  it('/health je veřejné', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('ok');
  });

  it('/api/tasks bez cookie → 401', async () => {
    const res = await fetch(`${base}/api/tasks`);
    expect(res.status).toBe(401);
  });

  it('kompletní lifecycle úkolu přes HTTP', async () => {
    const auth = { cookie };

    const list = await fetch(`${base}/api/tasks`, { headers: auth });
    expect(list.status).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'E2E úkol' }),
    });
    expect(created.status).toBe(201);
    const task = (await created.json()) as { name: string };
    expect(task.name).toBe('E2E úkol');

    const got = await fetch(`${base}/api/tasks/${DB_ID}`, { headers: auth });
    expect(got.status).toBe(200);

    const patched = await fetch(`${base}/api/tasks/${DB_ID}`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Done' }),
    });
    expect(patched.status).toBe(200);

    const sub = await fetch(`${base}/api/tasks/${DB_ID}/subtasks`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Podúkol' }),
    });
    expect(sub.status).toBe(201);

    const del = await fetch(`${base}/api/tasks/${DB_ID}`, { method: 'DELETE', headers: auth });
    expect(del.status).toBe(204);
  });

  it('GDPR export přes HTTP vrátí data bez tokenu', async () => {
    const res = await fetch(`${base}/api/account/export`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: { email: string } };
    expect(body.profile.email).toBe('a@b.cz');
    expect(JSON.stringify(body)).not.toContain('secret_t');
  });
});
