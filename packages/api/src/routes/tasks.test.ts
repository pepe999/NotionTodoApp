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
import { saveNotionConfig } from '../db/notionConfigs';
import { NotionService } from '../services/notion/service';
import { NotionClient } from '../services/notion/client';
import { RateLimitQueue } from '../services/notion/rateQueue';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
};
const DB_ID = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';
const T1 = '11111111-1111-4111-8111-111111111111';
const cipher = new TokenCipher('a'.repeat(64));

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

interface PageOpts {
  id: string;
  name: string;
  status?: string;
  tags?: string[];
  description?: string;
  parentId?: string;
}
function buildPage(o: PageOpts) {
  return {
    id: o.id,
    url: `https://notion.so/${o.id}`,
    last_edited_time: '2026-06-01T00:00:00.000Z',
    properties: {
      Name: { type: 'title', title: [{ plain_text: o.name }] },
      Status: { type: 'select', select: o.status ? { name: o.status } : null },
      Tags: { type: 'multi_select', multi_select: (o.tags ?? []).map((name) => ({ name })) },
      Description: {
        type: 'rich_text',
        rich_text: o.description ? [{ plain_text: o.description }] : [],
      },
      'Parent item': { type: 'relation', relation: o.parentId ? [{ id: o.parentId }] : [] },
    },
  };
}

/** Mock fetch směrující dle metody/URL na Notion endpointy. */
function notionFetch(opts: { queryPages?: unknown[]; page?: unknown; errorStatus?: number }) {
  return vi.fn(async (url: string | URL) => {
    if (opts.errorStatus) return jsonResponse({ message: 'err' }, opts.errorStatus);
    const u = String(url);
    if (u.includes('/query')) {
      return jsonResponse({ results: opts.queryPages ?? [], has_more: false, next_cursor: null });
    }
    return jsonResponse(opts.page ?? buildPage({ id: 'new-id', name: 'Nový' }));
  });
}

async function setup(fetchImpl: typeof fetch, withConfig = true) {
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
  const user = upsertUserByGoogle(db, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  const session = createSession(db, user.id);
  const cookie = await signSessionJwt(
    env.JWT_SECRET,
    { sid: session.sid, jti: session.rawToken },
    session.absoluteExpiry,
  );
  if (withConfig) {
    saveNotionConfig(db, cipher, {
      userId: user.id,
      token: 'secret_t',
      databaseId: DB_ID,
      validatedAt: 1,
    });
  }
  return { app, db, env, cookie };
}

describe('tasks routes', () => {
  it('401 bez cookie', async () => {
    const s = await setup(notionFetch({}) as unknown as typeof fetch);
    const res = await s.app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(401);
  });

  it('400 SetupRequired když chybí Notion konfigurace', async () => {
    const s = await setup(notionFetch({}) as unknown as typeof fetch, false);
    const res = await s.app.inject({
      method: 'GET',
      url: '/api/tasks',
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('SetupRequired');
  });

  it('GET /api/tasks vrátí flat list', async () => {
    const pages = [
      buildPage({ id: T1, name: 'Alpha', status: 'Todo', tags: ['work'] }),
      buildPage({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Beta',
        status: 'Done',
        tags: ['home', 'urgent'],
      }),
      buildPage({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Child',
        status: 'Todo',
        parentId: T1,
      }),
    ];
    const s = await setup(notionFetch({ queryPages: pages }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'GET',
      url: '/api/tasks',
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(3);
  });

  it('GET /api/tasks filtruje status, tags, search a parentId', async () => {
    const pages = [
      buildPage({ id: T1, name: 'Alpha', status: 'Todo', tags: ['work'] }),
      buildPage({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Beta',
        status: 'Done',
        tags: ['home', 'urgent'],
      }),
      buildPage({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Child',
        status: 'Todo',
        parentId: T1,
      }),
    ];
    const s = await setup(notionFetch({ queryPages: pages }) as unknown as typeof fetch);
    const call = (qs: string) =>
      s.app.inject({
        method: 'GET',
        url: `/api/tasks?${qs}`,
        cookies: { [SESSION_COOKIE]: s.cookie },
      });

    expect((await call('status=Todo')).json().map((t: { name: string }) => t.name)).toEqual([
      'Alpha',
      'Child',
    ]);
    expect((await call('tags=urgent')).json().map((t: { name: string }) => t.name)).toEqual([
      'Beta',
    ]);
    expect((await call('search=bet')).json().map((t: { name: string }) => t.name)).toEqual([
      'Beta',
    ]);
    expect((await call(`parentId=${T1}`)).json().map((t: { name: string }) => t.name)).toEqual([
      'Child',
    ]);
  });

  it('POST /api/tasks vytvoří úkol (201)', async () => {
    const created = buildPage({ id: 'new-1', name: 'Nový úkol', status: 'Todo' });
    const s = await setup(notionFetch({ page: created }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/tasks',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { name: 'Nový úkol' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Nový úkol');
  });

  it('POST /api/tasks odmítne prázdný název (400)', async () => {
    const s = await setup(notionFetch({}) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/tasks',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/tasks/:id vrátí detail', async () => {
    const page = buildPage({ id: T1, name: 'Detail', status: 'Review' });
    const s = await setup(notionFetch({ page }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'GET',
      url: `/api/tasks/${T1}`,
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('Review');
  });

  it('PATCH /api/tasks/:id upraví úkol', async () => {
    const page = buildPage({ id: T1, name: 'Alpha', status: 'Done' });
    const s = await setup(notionFetch({ page }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${T1}`,
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { status: 'Done' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('Done');
  });

  it('DELETE /api/tasks/:id vrátí 204', async () => {
    const s = await setup(
      notionFetch({ page: buildPage({ id: T1, name: 'X' }) }) as unknown as typeof fetch,
    );
    const res = await s.app.inject({
      method: 'DELETE',
      url: `/api/tasks/${T1}`,
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('GET /api/tasks/:id/subtasks vrátí jen podúkoly', async () => {
    const pages = [
      buildPage({ id: T1, name: 'Parent', status: 'Todo' }),
      buildPage({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Child',
        status: 'Todo',
        parentId: T1,
      }),
    ];
    const s = await setup(notionFetch({ queryPages: pages }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'GET',
      url: `/api/tasks/${T1}/subtasks`,
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((t: { name: string }) => t.name)).toEqual(['Child']);
  });

  it('POST /api/tasks/:id/subtasks vytvoří podúkol (201)', async () => {
    const child = buildPage({ id: 'c1', name: 'Podúkol', status: 'Todo', parentId: T1 });
    const s = await setup(notionFetch({ page: child }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'POST',
      url: `/api/tasks/${T1}/subtasks`,
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { name: 'Podúkol' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().parentId).toBe(T1);
  });

  it('Notion 404 → 404 NotionNotFound', async () => {
    const s = await setup(notionFetch({ errorStatus: 404 }) as unknown as typeof fetch);
    const res = await s.app.inject({
      method: 'GET',
      url: `/api/tasks/${T1}`,
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NotionNotFound');
  });
});
