import type { FastifyReply } from 'fastify';
import type { DB } from '../db/index';
import type { Env } from '../env';
import {
  createSession,
  findValidSession,
  touchSession,
  deleteSession,
  type SessionRow,
} from '../db/sessions';
import { signSessionJwt, verifySessionJwt } from './jwt';
import { upsertUserByGoogle, getUserById, type GoogleProfile, type User } from '../db/users';
import { SESSION_COOKIE, sessionCookieOptions, clearCookieOptions } from './cookies';

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

function toAuthedUser(user: User): AuthedUser {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url };
}

/** Upsertne uživatele, vytvoří novou session a nastaví session cookie. */
export async function establishSession(
  db: DB,
  env: Env,
  reply: FastifyReply,
  profile: GoogleProfile,
): Promise<AuthedUser> {
  const user = upsertUserByGoogle(db, profile);
  const session = createSession(db, user.id);
  const jwt = await signSessionJwt(
    env.JWT_SECRET,
    { sid: session.sid, jti: session.rawToken },
    session.absoluteExpiry,
  );
  reply.setCookie(SESSION_COOKIE, jwt, sessionCookieOptions(env, session.absoluteExpiry - Date.now()));
  return toAuthedUser(user);
}

/** Ověří session cookie: JWT podpis → DB session → uživatel. Posune sliding expiraci. */
export async function resolveSession(
  db: DB,
  env: Env,
  token: string | undefined,
): Promise<{ user: AuthedUser; session: SessionRow } | null> {
  if (!token) return null;
  const claims = await verifySessionJwt(env.JWT_SECRET, token);
  if (!claims) return null;
  const session = findValidSession(db, claims.sid, claims.jti);
  if (!session) return null;
  const user = getUserById(db, session.user_id);
  if (!user) return null;
  touchSession(db, session);
  return { user: toAuthedUser(user), session };
}

/** Smaže session z DB a zruší cookie (logout). */
export function revokeSessionCookie(
  db: DB,
  env: Env,
  reply: FastifyReply,
  sid: string | undefined,
): void {
  if (sid) deleteSession(db, sid);
  reply.clearCookie(SESSION_COOKIE, clearCookieOptions(env));
}
