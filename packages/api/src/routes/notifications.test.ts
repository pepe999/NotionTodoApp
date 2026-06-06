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
import { listAllDeviceTokens } from '../db/deviceTokens';
import { NotionService } from '../services/notion/service';
import { NotionClient } from '../services/notion/client';
import { RateLimitQueue } from '../services/notion/rateQueue';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
};
const cipher = new TokenCipher('a'.repeat(64));

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function setup() {
  const env: Env = envSchema.parse(baseEnv);
  db = openDb(':memory:');
  runMigrations(db);
  const notion = new NotionService({
    client: new NotionClient({
      fetchImpl: vi.fn() as unknown as typeof fetch,
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
  return { app, db, cookie };
}

describe('notifications routes', () => {
  it('register vyžaduje auth (401)', async () => {
    const s = await setup();
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/notifications/register',
      payload: { token: 'devtok' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('register uloží token a unregister ho smaže', async () => {
    const s = await setup();
    const reg = await s.app.inject({
      method: 'POST',
      url: '/api/notifications/register',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { token: 'devtok', platform: 'ios' },
    });
    expect(reg.statusCode).toBe(201);
    expect(listAllDeviceTokens(s.db)).toHaveLength(1);

    const del = await s.app.inject({
      method: 'DELETE',
      url: '/api/notifications/register',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { token: 'devtok' },
    });
    expect(del.statusCode).toBe(200);
    expect(listAllDeviceTokens(s.db)).toHaveLength(0);
  });

  it('odmítne prázdný token (400)', async () => {
    const s = await setup();
    const res = await s.app.inject({
      method: 'POST',
      url: '/api/notifications/register',
      cookies: { [SESSION_COOKIE]: s.cookie },
      payload: { token: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
