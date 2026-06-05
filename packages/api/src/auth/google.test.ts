import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, type KeyLike } from 'jose';
import { verifyGoogleIdToken } from './google';

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
  return new SignJWT({ email_verified: true, email: 'a@b.cz', name: 'A', picture: 'p', ...overrides })
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
    const profile = await verifyGoogleIdToken(token, { audiences: ['client-ios'], jwks: publicKey });
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
