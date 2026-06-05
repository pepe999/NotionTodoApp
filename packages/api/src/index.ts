import { loadEnv } from './env';
import { buildServer } from './server';
import { openDb } from './db/index';
import { runMigrations } from './db/migrate';
import { startSessionCleanup } from './db/sessions';

const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
runMigrations(db);
const stopCleanup = startSessionCleanup(db);

const app = await buildServer(env, { db });

await app.listen({ port: env.PORT, host: '0.0.0.0' });

// Graceful shutdown (PLAN.md 1.8): dokonči requesty, zavři DB, zastav cleanup.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void (async () => {
      app.log.info(`Přijat ${signal}, ukončuji…`);
      stopCleanup();
      await app.close();
      db.close();
      process.exit(0);
    })();
  });
}
