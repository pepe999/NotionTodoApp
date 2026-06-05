import { describe, it, expect, afterEach, vi } from 'vitest';
import type * as GoogleModule from '../auth/google';

// Stub jen výměny kódu + userinfo; zbytek google modulu zůstává reálný.
vi.mock('../auth/google', async (importActual) => {
  const actual = await importActual<typeof GoogleModule>();
  return {
    ...actual,
    exchangeCodeForTokens: vi.fn(async () => ({ access_token: 'AT' })),
    fetchGoogleUserInfo: vi.fn(async () => ({
      sub: 'g1',
      email: 'a@b.cz',
      name: 'A',
      picture: 'p',
    })),
  };
});

import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { envSchema, type Env } from '../env';
import { buildServer } from '../server';
import { openDb, type DB } from '../db/index';
import { runMigrations } from '../db/migrate';
import { getSecretKey } from '../auth/jwt';
import { SESSION_COOKIE, OAUTH_TX_COOKIE } from '../auth/cookies';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'sec',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
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
  const env: Env = envSchema.parse({ ...baseEnv, ...extra });
  db = openDb(':memory:');
  runMigrations(db);
  app = await buildServer(env, { db });
  return { app, db, env };
}

function txCookie(env: Env, state: string, codeVerifier: string): Promise<string> {
  return new SignJWT({ state, codeVerifier })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .sign(getSecretKey(env.JWT_SECRET));
}

describe('OAuth callback', () => {
  it('úspěšný callback vytvoří session, audit login a přesměruje', async () => {
    const s = await setup();
    const tx = await txCookie(s.env, 'st', 'verifier');
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=st',
      cookies: { [OAUTH_TX_COOKIE]: tx },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(s.env.FRONTEND_URL);
    expect(String(res.headers['set-cookie'])).toContain(SESSION_COOKIE);

    const events = (s.db.prepare('SELECT event FROM audit_log').all() as { event: string }[]).map(
      (r) => r.event,
    );
    expect(events).toContain('login');
  });

  it('callback s ?error=... → 400', async () => {
    const s = await setup();
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/google/callback?error=access_denied',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('OAuthError');
  });

  it('callback bez code/state → 400 InvalidRequest', async () => {
    const s = await setup();
    const tx = await txCookie(s.env, 'st', 'v');
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/google/callback',
      cookies: { [OAUTH_TX_COOKIE]: tx },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('InvalidRequest');
  });

  it('callback s neplatným tx cookie → 400 InvalidState', async () => {
    const s = await setup();
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=st',
      cookies: { [OAUTH_TX_COOKIE]: 'not-a-jwt' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('InvalidState');
  });

  it('callback se state mismatch → 400 StateMismatch', async () => {
    const s = await setup();
    const tx = await txCookie(s.env, 'expected', 'v');
    const res = await s.app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=different',
      cookies: { [OAUTH_TX_COOKIE]: tx },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('StateMismatch');
  });

  it('callback bez Google konfigurace → 501', async () => {
    const env = envSchema.parse({
      NODE_ENV: 'test',
      JWT_SECRET: 'x'.repeat(40),
      NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    db = openDb(':memory:');
    runMigrations(db);
    app = await buildServer(env, { db });
    const res = await app.inject({ method: 'GET', url: '/auth/google/callback?code=c&state=s' });
    expect(res.statusCode).toBe(501);
  });

  it('/auth/mobile s neplatným id_token → 401 + audit auth_failed', async () => {
    const s = await setup();
    const res = await s.app.inject({
      method: 'POST',
      url: '/auth/mobile',
      payload: { id_token: 'invalid.jwt.token' },
    });
    expect(res.statusCode).toBe(401);
    const events = (s.db.prepare('SELECT event FROM audit_log').all() as { event: string }[]).map(
      (r) => r.event,
    );
    expect(events).toContain('auth_failed');
  });
});
