import { loadEnv } from './env';
import { buildServer } from './server';
import { openDb } from './db/index';
import { runMigrations } from './db/migrate';
import { startSessionCleanup } from './db/sessions';
import { startAuditLogCleanup } from './db/auditLog';
import { TokenCipher } from './crypto/tokenCrypto';
import { NotionService } from './services/notion/service';
import { getApnsConfig } from './apns/token';
import { Http2ApnsSender } from './apns/sender';
import { runDueNotifications } from './notifications/scheduler';

const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
runMigrations(db);
const stopCleanup = startSessionCleanup(db);
const stopAuditCleanup = startAuditLogCleanup(db);

// APNs scheduler (PLAN.md 5.8) – jen pokud je APNs kompletně nakonfigurováno.
let stopNotifications: (() => void) | undefined;
const apnsConfig = getApnsConfig(env);
if (apnsConfig) {
  const cipher = new TokenCipher(env.NOTION_ENCRYPTION_KEY);
  const notion = new NotionService();
  const sender = new Http2ApnsSender(apnsConfig);
  const HOUR = 60 * 60 * 1000;
  const timer = setInterval(() => {
    void runDueNotifications({ db, cipher, notion, sender }).catch(() => undefined);
  }, HOUR);
  timer.unref();
  stopNotifications = () => clearInterval(timer);
}

const app = await buildServer(env, { db });

await app.listen({ port: env.PORT, host: '0.0.0.0' });

// Graceful shutdown (PLAN.md 1.8): dokonči requesty, zavři DB, zastav cleanup.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void (async () => {
      app.log.info(`Přijat ${signal}, ukončuji…`);
      stopCleanup();
      stopAuditCleanup();
      stopNotifications?.();
      await app.close();
      db.close();
      process.exit(0);
    })();
  });
}
