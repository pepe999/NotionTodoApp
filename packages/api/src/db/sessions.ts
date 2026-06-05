import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { DB } from './index';

const HOUR_MS = 60 * 60 * 1000;

/** Idle timeout – session vyprší po této době neaktivity (sliding). */
export const IDLE_TTL_MS = 7 * 24 * HOUR_MS; // 7 dní
/** Absolutní strop – session nikdy nepřežije déle než tohle od vytvoření. */
export const ABSOLUTE_TTL_MS = 30 * 24 * HOUR_MS; // 30 dní
/** Aby se nezapisovalo při každém requestu, last_seen se aktualizuje s odstupem. */
const TOUCH_THROTTLE_MS = 60 * 1000;

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  last_seen_at: number;
  created_at: number;
}

export interface CreatedSession {
  sid: string;
  /** Opaque token (32B) – jde do JWT jako jti; v DB je jen jeho hash. */
  rawToken: string;
  absoluteExpiry: number;
}

/** SHA-256 hash opaque tokenu (v DB nikdy neukládáme plaintext). */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createSession(db: DB, userId: string, now: number = Date.now()): CreatedSession {
  const sid = randomUUID();
  const rawToken = randomBytes(32).toString('base64url');
  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(sid, userId, hashToken(rawToken), now + IDLE_TTL_MS, now, now);
  return { sid, rawToken, absoluteExpiry: now + ABSOLUTE_TTL_MS };
}

/** Najde session a ověří token hash, idle i absolutní expiraci. */
export function findValidSession(
  db: DB,
  sid: string,
  rawToken: string,
  now: number = Date.now(),
): SessionRow | undefined {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) as SessionRow | undefined;
  if (!row) return undefined;
  if (row.token_hash !== hashToken(rawToken)) return undefined;
  if (row.expires_at < now) return undefined; // idle timeout
  if (row.created_at + ABSOLUTE_TTL_MS < now) return undefined; // absolutní strop
  return row;
}

/** Posune sliding expiraci (s throttlingem), nepřekročí absolutní strop. */
export function touchSession(db: DB, row: SessionRow, now: number = Date.now()): void {
  if (now - row.last_seen_at < TOUCH_THROTTLE_MS) return;
  const newExpiry = Math.min(now + IDLE_TTL_MS, row.created_at + ABSOLUTE_TTL_MS);
  db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(
    now,
    newExpiry,
    row.id,
  );
}

export function deleteSession(db: DB, sid: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

/** Smaže expirované sessions. Vrací počet odstraněných záznamů. */
export function cleanupExpiredSessions(db: DB, now: number = Date.now()): number {
  return db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now).changes;
}

/**
 * Periodický cleanup expirovaných sessions (výchozí: každou hodinu).
 * Timer je `unref`-ovaný, aby neblokoval ukončení procesu. Vrací stop funkci.
 */
export function startSessionCleanup(db: DB, intervalMs: number = HOUR_MS): () => void {
  cleanupExpiredSessions(db);
  const timer = setInterval(() => cleanupExpiredSessions(db), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
