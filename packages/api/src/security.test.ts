import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { envSchema } from './env';
import { buildServer } from './server';
import { openDb, type DB } from './db/index';
import { runMigrations } from './db/migrate';

const baseEnv = {
  JWT_SECRET: 'x'.repeat(40),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
  FRONTEND_URL: 'http://localhost:5173',
};

let app: FastifyInstance | undefined;
let db: DB | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function build(nodeEnv: 'production' | 'test') {
  const env = envSchema.parse({ ...baseEnv, NODE_ENV: nodeEnv });
  db = openDb(':memory:');
  runMigrations(db);
  app = await buildServer(env, { db });
  return app;
}

describe('security headers', () => {
  it('produkce: CSP, HSTS a doplňkové hlavičky', async () => {
    const a = await build('production');
    const res = await a.inject({ method: 'GET', url: '/health' });
    const h = res.headers;

    const csp = String(h['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'"); // Tailwind v4 = statické CSS

    expect(h['strict-transport-security']).toContain('max-age=63072000');
    expect(h['strict-transport-security']).toContain('includeSubDomains');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(String(h['permissions-policy'])).toContain('camera=()');
    expect(h['x-frame-options']).toBeDefined();
    expect(h['x-powered-by']).toBeUndefined();
  });

  it('dev/test: CSP vypnutá (kvůli Swagger), ale ostatní hlavičky drží', async () => {
    const a = await build('test');
    const res = await a.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(String(res.headers['permissions-policy'])).toContain('microphone=()');
  });
});

describe('CORS', () => {
  it('nereflektuje libovolný origin – vrací jen nakonfigurovaný FRONTEND_URL', async () => {
    const a = await build('test');
    const res = await a.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('preflight (OPTIONS) vrátí povolené metody a max-age', async () => {
    const a = await build('test');
    const res = await a.inject({
      method: 'OPTIONS',
      url: '/api/tasks',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(String(res.headers['access-control-allow-methods'])).toContain('GET');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });
});
