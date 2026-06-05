import { describe, it, expect, beforeAll, vi } from 'vitest';
import { SignJWT, generateKeyPair, type KeyLike } from 'jose';
import {
  verifyGoogleIdToken,
  isGoogleConfigured,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
} from './google';
import { envSchema, type Env } from '../env';

const googleEnv = (): Env =>
  envSchema.parse({
    JWT_SECRET: 'x'.repeat(40),
    NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'sec',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
  });

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let privateKey: KeyLike;
let publicKey: KeyLike;

beforeAll(async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey;
  publicKey = kp.publicKey;
});

async function makeIdToken(
  overrides: Record<string, unknown> = {},
  audience = 'client-ios',
): Promise<string> {
  return new SignJWT({
    email_verified: true,
    email: 'a@b.cz',
    name: 'A',
    picture: 'p',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setSubject('g1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

describe('verifyGoogleIdToken', () => {
  it('ověří platný id_token', async () => {
    const token = await makeIdToken();
    const profile = await verifyGoogleIdToken(token, {
      audiences: ['client-ios'],
      jwks: publicKey,
    });
    expect(profile).toMatchObject({ sub: 'g1', email: 'a@b.cz', name: 'A' });
  });

  it('odmítne špatné audience', async () => {
    const token = await makeIdToken({}, 'jine-aud');
    await expect(
      verifyGoogleIdToken(token, { audiences: ['client-ios'], jwks: publicKey }),
    ).rejects.toThrow();
  });

  it('odmítne neověřený email', async () => {
    const token = await makeIdToken({ email_verified: false });
    await expect(
      verifyGoogleIdToken(token, { audiences: ['client-ios'], jwks: publicKey }),
    ).rejects.toThrow();
  });

  it('odmítne cizí podpis', async () => {
    const other = await generateKeyPair('RS256');
    const token = await new SignJWT({ email_verified: true, email: 'a@b.cz' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('client-ios')
      .setSubject('g1')
      .setExpirationTime('5m')
      .sign(other.privateKey);
    await expect(
      verifyGoogleIdToken(token, { audiences: ['client-ios'], jwks: publicKey }),
    ).rejects.toThrow();
  });
});

describe('isGoogleConfigured', () => {
  it('true jen s kompletní konfigurací', () => {
    expect(isGoogleConfigured(googleEnv())).toBe(true);
    const partial = envSchema.parse({
      JWT_SECRET: 'x'.repeat(40),
      NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    expect(isGoogleConfigured(partial)).toBe(false);
  });
});

describe('buildGoogleAuthUrl', () => {
  it('sestaví URL s PKCE a state', () => {
    const url = buildGoogleAuthUrl(googleEnv() as never, { state: 'st', codeChallenge: 'ch' });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('code_challenge=ch');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=st');
    expect(url).toContain('client_id=cid');
  });
});

describe('exchangeCodeForTokens', () => {
  it('vrátí tokeny při 200', async () => {
    const fetchMock = vi.fn(async () => jsonRes({ access_token: 'AT', id_token: 'IT' }));
    const tokens = await exchangeCodeForTokens(
      googleEnv() as never,
      'code',
      'verifier',
      fetchMock as unknown as typeof fetch,
    );
    expect(tokens.access_token).toBe('AT');
    const calls = fetchMock.mock.calls as unknown as Array<[string, { body: URLSearchParams }]>;
    expect(String(calls[0]?.[1].body)).toContain('code_verifier=verifier');
  });

  it('vyhodí chybu při non-200', async () => {
    const fetchMock = vi.fn(async () => jsonRes({ error: 'bad' }, 400));
    await expect(
      exchangeCodeForTokens(googleEnv() as never, 'c', 'v', fetchMock as unknown as typeof fetch),
    ).rejects.toThrow();
  });
});

describe('fetchGoogleUserInfo', () => {
  it('vrátí profil', async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ sub: 'g1', email: 'a@b.cz', name: 'A', picture: 'p' }),
    );
    const profile = await fetchGoogleUserInfo('AT', fetchMock as unknown as typeof fetch);
    expect(profile).toEqual({ sub: 'g1', email: 'a@b.cz', name: 'A', picture: 'p' });
  });

  it('vyhodí při non-200', async () => {
    const fetchMock = vi.fn(async () => jsonRes({}, 401));
    await expect(fetchGoogleUserInfo('AT', fetchMock as unknown as typeof fetch)).rejects.toThrow();
  });

  it('vyhodí při chybějícím sub/email', async () => {
    const fetchMock = vi.fn(async () => jsonRes({ name: 'A' }));
    await expect(fetchGoogleUserInfo('AT', fetchMock as unknown as typeof fetch)).rejects.toThrow();
  });
});
