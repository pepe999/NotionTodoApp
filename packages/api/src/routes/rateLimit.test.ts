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
const cipher = new TokenCipher('a'.repeat(64));

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

function emptyQueryFetch(): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ results: [], has_more: false, next_cursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

async function setup(extraEnv: Record<string, string> = {}) {
  const env: Env = envSchema.parse({ ...baseEnv, ...extraEnv });
  db = openDb(':memory:');
  runMigrations(db);
  const notion = new NotionService({
    client: new NotionClient({
      fetchImpl: emptyQueryFetch(),
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
  return { app, env, cookie };
}

describe('rate limiting', () => {
  it('úroveň 1: per-IP limit na /auth/* vrátí 429 po překročení', async () => {
    const s = await setup({ RATE_LIMIT_AUTH_MAX: '2' });
    const hit = () => s.app.inject({ method: 'GET', url: '/auth/me' });
    expect((await hit()).statusCode).toBe(401); // 1
    expect((await hit()).statusCode).toBe(401); // 2
    const third = await hit(); // 3 → rate limited PŘED auth
    expect(third.statusCode).toBe(429);
    expect(third.json().error).toBe('TooManyRequests');
  });

  it('úroveň 2: per-user limit na /api/* vrátí 429 + Retry-After', async () => {
    const s = await setup({ RATE_LIMIT_API_USER_MAX: '2' });
    const hit = () =>
      s.app.inject({ method: 'GET', url: '/api/tasks', cookies: { [SESSION_COOKIE]: s.cookie } });
    expect((await hit()).statusCode).toBe(200); // 1
    expect((await hit()).statusCode).toBe(200); // 2
    const third = await hit(); // 3 → per-user limit
    expect(third.statusCode).toBe(429);
    expect(third.json().error).toBe('TooManyRequests');
    expect(third.headers['retry-after']).toBeDefined();
    expect(third.headers['ratelimit-limit']).toBe('2');
  });

  it('/health je vyňato z rate limitu, ostatní routy ne', async () => {
    const s = await setup({ RATE_LIMIT_API_IP_MAX: '1' });
    // /health projde i nad limit (allowList)
    expect((await s.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await s.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await s.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    // neautentizovaná /api/tasks: 1. projde k auth (401), 2. už je nad IP limitem (429)
    expect((await s.app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(429);
  });
});
