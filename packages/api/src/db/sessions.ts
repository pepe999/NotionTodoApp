import type { DB } from './index';

const HOUR_MS = 60 * 60 * 1000;

/** Smaže expirované sessions. Vrací počet odstraněných záznamů. */
export function cleanupExpiredSessions(db: DB, now: number = Date.now()): number {
  return db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now).changes;
}

/**
 * Spustí periodický cleanup expirovaných sessions (výchozí: každou hodinu).
 * Timer je `unref`-ovaný, aby neblokoval ukončení procesu.
 * Vrací funkci pro zastavení.
 */
export function startSessionCleanup(db: DB, intervalMs: number = HOUR_MS): () => void {
  cleanupExpiredSessions(db);
  const timer = setInterval(() => cleanupExpiredSessions(db), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
