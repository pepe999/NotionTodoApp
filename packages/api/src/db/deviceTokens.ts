import { randomUUID } from 'node:crypto';
import type { DB } from './index';

/** APNs device tokeny (PLAN.md 5.8). */
export interface DeviceTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  last_notified_at: number | null;
  created_at: number;
}

/** Upsert tokenu (token je UNIQUE) – při kolizi přepíše vlastníka/platformu. */
export function registerDeviceToken(
  db: DB,
  params: { userId: string; token: string; platform: string },
  now: number = Date.now(),
): void {
  db.prepare(
    `INSERT INTO device_tokens (id, user_id, token, platform, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
  ).run(randomUUID(), params.userId, params.token, params.platform, now);
}

export function removeDeviceToken(db: DB, token: string): void {
  db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
}

export function listDeviceTokensForUser(db: DB, userId: string): DeviceTokenRow[] {
  return db
    .prepare('SELECT * FROM device_tokens WHERE user_id = ?')
    .all(userId) as DeviceTokenRow[];
}

export function listAllDeviceTokens(db: DB): DeviceTokenRow[] {
  return db.prepare('SELECT * FROM device_tokens').all() as DeviceTokenRow[];
}

export function markDeviceNotified(db: DB, id: string, now: number = Date.now()): void {
  db.prepare('UPDATE device_tokens SET last_notified_at = ? WHERE id = ?').run(now, id);
}
