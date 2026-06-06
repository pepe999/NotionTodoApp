import { SignJWT, importPKCS8 } from 'jose';
import type { Env } from '../env';

/** Kompletní APNs konfigurace (PLAN.md 5.8). */
export interface ApnsConfig {
  teamId: string;
  keyId: string;
  bundleId: string;
  privateKey: string; // PKCS#8 PEM (.p8)
  sandbox: boolean;
}

/** Vrátí konfiguraci jen pokud jsou všechny APNs proměnné nastaveny, jinak null. */
export function getApnsConfig(env: Env): ApnsConfig | null {
  if (!env.APNS_TEAM_ID || !env.APNS_KEY_ID || !env.APNS_BUNDLE_ID || !env.APNS_PRIVATE_KEY) {
    return null;
  }
  return {
    teamId: env.APNS_TEAM_ID,
    keyId: env.APNS_KEY_ID,
    bundleId: env.APNS_BUNDLE_ID,
    privateKey: env.APNS_PRIVATE_KEY,
    sandbox: env.APNS_SANDBOX,
  };
}

// Provider token se dle Applu obnovuje ~ každých 20–60 min; cachujeme na 50 min.
const TOKEN_TTL_MS = 50 * 60 * 1000;
let cached: { token: string; createdAt: number } | null = null;

/** Vytvoří (a cachuje) APNs provider JWT (ES256, header kid, iss=teamId). */
export async function getProviderToken(
  config: ApnsConfig,
  now: number = Date.now(),
): Promise<string> {
  if (cached && now - cached.createdAt < TOKEN_TTL_MS) return cached.token;
  const key = await importPKCS8(config.privateKey, 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(Math.floor(now / 1000))
    .sign(key);
  cached = { token, createdAt: now };
  return token;
}

/** Pro testy – vyprázdní cache provider tokenu. */
export function resetApnsTokenCache(): void {
  cached = null;
}
