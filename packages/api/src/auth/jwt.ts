import { SignJWT, jwtVerify } from 'jose';

/** Jediný povolený podpisový algoritmus (symetrický HMAC). NIKDY 'none'. */
const ALG = 'HS256';

export interface SessionClaims {
  sid: string;
  jti: string;
}

export function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionJwt(
  secret: string,
  claims: SessionClaims,
  absoluteExpiryMs: number,
): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: ALG })
    .setJti(claims.jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(absoluteExpiryMs / 1000))
    .sign(getSecretKey(secret));
}

/** Ověří podpis + expiraci, vynucuje alg whitelist. Vrací null při nevalidním tokenu. */
export async function verifySessionJwt(
  secret: string,
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), { algorithms: [ALG] });
    if (typeof payload.sid !== 'string' || typeof payload.jti !== 'string') return null;
    return { sid: payload.sid, jti: payload.jti };
  } catch {
    return null;
  }
}
