import { describe, it, expect } from 'vitest';
import { TokenCipher, safeEqual } from './tokenCrypto';

const KEY = 'a'.repeat(64); // 32 bajtů v hex

describe('TokenCipher', () => {
  it('zašifruje a dešifruje token (round-trip)', () => {
    const cipher = new TokenCipher(KEY);
    const secret = 'secret_notion_token_123';
    const enc = cipher.encrypt(secret);
    expect(enc.ciphertext).not.toContain(secret);
    expect(cipher.decrypt(enc)).toBe(secret);
  });

  it('generuje unikátní IV pro každý zápis', () => {
    const cipher = new TokenCipher(KEY);
    const a = cipher.encrypt('same-input');
    const b = cipher.encrypt('same-input');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('ukládá key_version', () => {
    expect(new TokenCipher(KEY, 2).encrypt('x').keyVersion).toBe(2);
  });

  it('odmítne klíč nesprávné délky', () => {
    expect(() => new TokenCipher('abcd')).toThrow();
  });

  it('detekuje pozměněný ciphertext (tamper)', () => {
    const cipher = new TokenCipher(KEY);
    const enc = cipher.encrypt('tajne');
    const tampered = { ...enc, ciphertext: Buffer.from('jinydata').toString('base64') };
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('selže s jiným klíčem', () => {
    const enc = new TokenCipher('a'.repeat(64)).encrypt('tajne');
    expect(() => new TokenCipher('b'.repeat(64)).decrypt(enc)).toThrow();
  });
});

describe('safeEqual', () => {
  it('porovná shodné a neshodné hodnoty', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
