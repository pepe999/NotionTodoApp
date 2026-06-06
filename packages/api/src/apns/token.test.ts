import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { getApnsConfig, getProviderToken, resetApnsTokenCache, type ApnsConfig } from './token';
import { envSchema } from '../env';

beforeEach(() => resetApnsTokenCache());

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('getApnsConfig', () => {
  it('null bez kompletní konfigurace', () => {
    const env = envSchema.parse({
      JWT_SECRET: 'x'.repeat(40),
      NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    expect(getApnsConfig(env)).toBeNull();
  });

  it('config při kompletní konfiguraci', () => {
    const env = envSchema.parse({
      JWT_SECRET: 'x'.repeat(40),
      NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
      APNS_TEAM_ID: 'TEAM',
      APNS_KEY_ID: 'KEY',
      APNS_BUNDLE_ID: 'com.app',
      APNS_PRIVATE_KEY: 'pem',
    });
    expect(getApnsConfig(env)).toMatchObject({ teamId: 'TEAM', keyId: 'KEY', bundleId: 'com.app' });
  });
});

describe('getProviderToken', () => {
  it('vytvoří ES256 JWT s kid a iss', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    const config: ApnsConfig = {
      teamId: 'TEAMID',
      keyId: 'KEYID',
      bundleId: 'com.app',
      privateKey: await exportPKCS8(privateKey),
      sandbox: true,
    };
    const jwt = await getProviderToken(config);
    const [header, payload] = jwt.split('.');
    expect(decode(header!)).toMatchObject({ alg: 'ES256', kid: 'KEYID' });
    expect(decode(payload!)).toMatchObject({ iss: 'TEAMID' });
  });
});
