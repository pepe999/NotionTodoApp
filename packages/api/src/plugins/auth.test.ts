import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { envSchema, type Env } from '../env';
import { buildServer } from '../server';
import { openDb, type DB } from '../db/index';
import { runMigrations } from '../db/migrate';
import { upsertUserByGoogle } from '../db/users';
import { createSession } from '../db/sessions';
import { signSessionJwt } from '../auth/jwt';
import { SESSION_COOKIE } from '../auth/cookies';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
};

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function setup(extra: Record<string, string> = {}) {
  const env = envSchema.parse({ ...baseEnv, ...extra });
  db = openDb(':memory:');
  runMigrations(db);
  app = await buildServer(env, { db });
  return { app, db, env };
}

async function authCookie(database: DB, env: Env): Promise<string> {
  const user = upsertUserByGoogle(database, { sub: 'g1', email: 'a@b.cz', name: 'A' });
  const session = createSession(database, user.id);
  return signSessionJwt(env.JWT_SECRET, { sid: session.sid, jti: session.rawToken }, session.absoluteExpiry);
}

describe('auth routes', () => {
  it('/auth/me vrací 401 bez cookie', async () => {
    const s = await setup();
    const res = await s.app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('/auth/me vrací uživatele s platnou session', async () => {
    const s = await setup();
    const jwt = await authCookie(s.db, s.env);
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: jwt },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('a@b.cz');
  });

  it('logout smaže session (následné /auth/me je 401)', async () => {
    const s = await setup();
    const jwt = await authCookie(s.db, s.env);
    const out = await s.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [SESSION_COOKIE]: jwt },
    });
    expect(out.statusCode).toBe(200);
    const after = await s.app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: jwt },
    });
    expect(after.statusCode).toBe(401);
  });

  it('/auth/google vrací 501 bez konfigurace', async () => {
    const s = await setup();
    const res = await s.app.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(501);
  });

  it('/auth/google přesměruje na Google + nastaví tx cookie', async () => {
    const s = await setup({
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'sec',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    });
    const res = await s.app.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    expect(res.headers.location).toContain('code_challenge_method=S256');
    expect(String(res.headers['set-cookie'])).toContain('nta_oauth_tx');
  });

  it('/auth/mobile vrací 400 bez id_token', async () => {
    const s = await setup({
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'sec',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/cb',
    });
    const res = await s.app.inject({ method: 'POST', url: '/auth/mobile', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
