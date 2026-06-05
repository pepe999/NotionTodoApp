import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bitů – doporučeno pro GCM
const KEY_LENGTH = 32; // AES-256
const AUTH_TAG_LENGTH = 16;

/** Zašifrovaný Notion token – IV a auth tag se ukládají zvlášť (PLAN.md 1.2). */
export interface EncryptedToken {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  keyVersion: number;
}

/**
 * AES-256-GCM šifrování Notion integration tokenu.
 * Pro každý zápis se generuje nový náhodný IV (nikdy neopakovat dvojici klíč+IV).
 * `keyVersion` umožňuje budoucí rotaci klíče.
 */
export class TokenCipher {
  private readonly key: Buffer;
  readonly keyVersion: number;

  constructor(hexKey: string, keyVersion = 1) {
    const key = Buffer.from(hexKey, 'hex');
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `Šifrovací klíč musí mít ${KEY_LENGTH} bajtů (hex ${KEY_LENGTH * 2} znaků), má ${key.length}.`,
      );
    }
    this.key = key;
    this.keyVersion = keyVersion;
  }

  encrypt(plaintext: string): EncryptedToken {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  decrypt(enc: EncryptedToken): string {
    const iv = Buffer.from(enc.iv, 'base64');
    const authTag = Buffer.from(enc.authTag, 'base64');
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Neplatná délka auth tagu.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(enc.ciphertext, 'base64')),
      decipher.final(), // vyhodí chybu, pokud auth tag nesedí (tamper detection)
    ]);
    return plaintext.toString('utf8');
  }
}

/** Konstantně-časové porovnání dvou tokenů/hashů. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
