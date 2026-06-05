import type { FastifyReply } from 'fastify';
import type { Env } from '../env';

export const SESSION_COOKIE = 'nta_session';
export const OAUTH_TX_COOKIE = 'nta_oauth_tx';
export const OAUTH_TX_PATH = '/auth';

// Typ options odvozený z reply.setCookie (augmentace @fastify/cookie).
type CookieOptions = NonNullable<Parameters<FastifyReply['setCookie']>[2]>;

/** Session cookie: HTTPOnly, Secure (jen prod), SameSite=Lax kvůli OAuth redirectu. */
export function sessionCookieOptions(env: Env, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/** Krátkodobé cookie pro OAuth transakci (state + PKCE verifier). */
export function oauthTxCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: OAUTH_TX_PATH,
    maxAge: 600, // 10 min
  };
}

export function clearCookieOptions(env: Env, path = '/'): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };
}
