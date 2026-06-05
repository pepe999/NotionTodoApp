import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export type DB = Database.Database;

/**
 * Otevře SQLite databázi (jen auth data – users, sessions, notion_configs).
 * WAL mode pro lepší souběh čtení/zápisu, zapnuté foreign keys.
 */
export function openDb(path: string): DB {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
