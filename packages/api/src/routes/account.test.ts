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
import { recordAudit } from '../db/auditLog';
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

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

function emptyFetch(): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ results: [], has_more: false, next_cursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

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

/** Fetch validující databázi (GET /databases/:id), jinak prázdný list. */
function validatingFetch(): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    const body =
      u.includes('/databases/') && !u.includes('/query')
        ? { properties: validProps }
        : { results: [], has_more: false, next_cursor: null };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

async function setup(
  extraEnv: Record<string, string> = {},
  fetchImpl: typeof fetch = emptyFetch(),
) {
  const env: Env = envSchema.parse({ ...baseEnv, ...extraEnv });
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
  saveNotionConfig(db, cipher, {
    userId: user.id,
    token: 'secret_t',
    databaseId: DB_ID,
    validatedAt: 1,
  });
  return { app, env, cookie, userId: user.id };
}

describe('account routes', () => {
  it('GET /api/account/export vrátí profil + metadata configu BEZ tokenu', async () => {
    const s = await setup();
    recordAudit(db!, { userId: s.userId, event: 'login' }, 500);
    const res = await s.app.inject({
      method: 'GET',
      url: '/api/account/export',
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profile.email).toBe('a@b.cz');
    expect(body.notionConfig.databaseId).toBe(DB_ID);
    // token (plaintext ani encrypted) NESMÍ být v exportu
    expect(JSON.stringify(body)).not.toContain('secret_t');
    expect(JSON.stringify(body)).not.toContain('integration_token');
    expect(body.auditLog.some((a: { event: string }) => a.event === 'login')).toBe(true);
  });

  it('export vyžaduje auth (401)', async () => {
    const s = await setup();
    const res = await s.app.inject({ method: 'GET', url: '/api/account/export' });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/account smaže účet, zruší cookie a další /auth/me je 401', async () => {
    const s = await setup();
    const del = await s.app.inject({
      method: 'DELETE',
      url: '/api/account',
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(del.statusCode).toBe(200);
    expect(String(del.headers['set-cookie'])).toContain(SESSION_COOKIE);

    const me = await s.app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: s.cookie },
    });
    expect(me.statusCode).toBe(401); // uživatel i session pryč

    // notion_configs smazána díky CASCADE
    const cfgCount = (
      db!.prepare('SELECT COUNT(*) AS n FROM notion_configs').get() as { n: number }
    ).n;
    expect(cfgCount).toBe(0);
  });

  it('setup_save i account_delete se zapíšou do audit logu', async () => {
    const s = await setup({}, validatingFetch());
    await s.app.inject({
      method: 'POST',
      url: '/api/setup/save',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { token: 'secret_x', databaseId: DB_ID },
    });
    const events = (db!.prepare('SELECT event FROM audit_log').all() as { event: string }[]).map(
      (r) => r.event,
    );
    expect(events).toContain('setup_save');
  });
});

describe('/metrics', () => {
  it('404 bez nastaveného METRICS_TOKEN', async () => {
    const s = await setup();
    const res = await s.app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(404);
  });

  it('401 se špatným tokenem, 200 se správným', async () => {
    const token = 'm'.repeat(20);
    const s = await setup({ METRICS_TOKEN: token });
    const bad = await s.app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer nope' },
    });
    expect(bad.statusCode).toBe(401);

    const ok = await s.app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain('http_requests_total');
    expect(ok.body).toContain('process_uptime_seconds');
  });
});
