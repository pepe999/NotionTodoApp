import { loadEnv } from '../env';
import { openDb } from './index';
import { runMigrations } from './migrate';

// CLI: `npm run db:migrate`. Samostatný entrypoint, aby `migrate.ts` neměl
// žádný side-effect při startu (důležité po bundlování do dist/index.js).
const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
try {
  const ran = runMigrations(db);
  console.log(ran.length ? `✅ Aplikováno: ${ran.join(', ')}` : '✅ Žádné čekající migrace.');
} finally {
  db.close();
}
