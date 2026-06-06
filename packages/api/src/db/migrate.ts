import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Spustí čekající SQL migrace seřazené dle názvu. Idempotentní –
 * provedené migrace eviduje v tabulce schema_migrations a přeskakuje je.
 * Každá migrace běží v transakci.
 *
 * @returns názvy migrací, které byly v tomto běhu aplikovány
 */
export function runMigrations(db: DB, dir: string = MIGRATIONS_DIR): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at INTEGER NOT NULL
     );`,
  );

  const appliedRows = db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[];
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(file, Date.now());
    });
    tx();
    ran.push(file);
  }

  return ran;
}
