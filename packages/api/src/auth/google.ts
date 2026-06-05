import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type KeyLike } from 'jose';
import type { Env } from '../env';
import type { GoogleProfile } from '../db/users';

// Hardcoded Google endpointy (žádný user input → ochrana proti SSRF).
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

type GoogleEnv = Env & {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
};

export function isGoogleConfigured(env: Env): env is GoogleEnv {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export function buildGoogleAuthUrl(
  env: GoogleEnv,
  params: { state: string; codeChallenge: string },
): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(
  env: GoogleEnv,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: env.GOOGLE_REDIRECT_URI,
  });
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Token exchange selhal (${res.status}).`);
  return (await res.json()) as TokenResponse;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile> {
  const res = await fetchImpl(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Userinfo selhal (${res.status}).`);
  const data = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!data.sub || !data.email) throw new Error('Userinfo bez sub/email.');
  return { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
}

let cachedJwks: JWTVerifyGetKey | undefined;
function getGoogleJwks(): JWTVerifyGetKey {
  cachedJwks ??= createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));
  return cachedJwks;
}

export interface VerifyIdTokenOptions {
  audiences: string[];
  /** Injektovatelný klíč/JWKS pro testy. */
  jwks?: JWTVerifyGetKey | KeyLike | Uint8Array;
}

/**
 * Ověří Google id_token (iOS flow): podpis proti JWKS, iss, aud, exp, email_verified.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  opts: VerifyIdTokenOptions,
): Promise<GoogleProfile> {
  const key = opts.jwks ?? getGoogleJwks();
  const { payload } = await jwtVerify(idToken, key as JWTVerifyGetKey, {
    issuer: GOOGLE_ISSUERS,
    audience: opts.audiences,
  });
  if (payload.email_verified !== true) throw new Error('Email není ověřený.');
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('id_token bez sub/email.');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
