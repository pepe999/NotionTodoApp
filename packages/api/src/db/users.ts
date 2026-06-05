import { randomUUID } from 'node:crypto';
import type { DB } from './index';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
}

/** Profil získaný z Google (userinfo nebo ověřený id_token). */
export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string | undefined;
  picture?: string | undefined;
}

/** Vytvoří nebo aktualizuje uživatele podle Google ID (sub). */
export function upsertUserByGoogle(db: DB, profile: GoogleProfile, now: number = Date.now()): User {
  const existing = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub) as
    | User
    | undefined;

  if (existing) {
    db.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?').run(
      profile.email,
      profile.name ?? null,
      profile.picture ?? null,
      existing.id,
    );
    return {
      ...existing,
      email: profile.email,
      name: profile.name ?? null,
      avatar_url: profile.picture ?? null,
    };
  }

  const user: User = {
    id: randomUUID(),
    google_id: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    avatar_url: profile.picture ?? null,
    created_at: now,
  };
  db.prepare(
    'INSERT INTO users (id, google_id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(user.id, user.google_id, user.email, user.name, user.avatar_url, user.created_at);
  return user;
}

export function getUserById(db: DB, id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

/** Smaže uživatele. CASCADE odstraní sessions + notion_configs; audit_log se anonymizuje (SET NULL). */
export function deleteUser(db: DB, id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
