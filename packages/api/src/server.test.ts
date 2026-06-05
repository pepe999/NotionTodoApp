import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { envSchema } from './env';
import { buildServer } from './server';
import { openDb } from './db/index';
import { runMigrations } from './db/migrate';

const testEnv = envSchema.parse({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(32),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
});

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('server', () => {
  it('/health vrací ok a stav DB', async () => {
    const db = openDb(':memory:');
    runMigrations(db);
    app = await buildServer(testEnv, { db });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
    db.close();
  });

  it('CORS odmítne nepovolený origin', async () => {
    app = await buildServer(testEnv);
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    });
    // Origin se neodrazí zpět pro nepovolenou doménu.
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
  });
});
