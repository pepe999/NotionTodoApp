import { describe, it, expect, vi, afterEach } from 'vitest';
import { envSchema, loadEnv } from './env';

const valid = {
  JWT_SECRET: 'x'.repeat(32),
  NOTION_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('envSchema', () => {
  it('doplní výchozí hodnoty', () => {
    const env = envSchema.parse(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
  });

  it('koercuje PORT na číslo', () => {
    expect(envSchema.parse({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('odmítne krátký JWT_SECRET', () => {
    expect(envSchema.safeParse({ ...valid, JWT_SECRET: 'short' }).success).toBe(false);
  });

  it('odmítne NOTION_ENCRYPTION_KEY špatné délky/formátu', () => {
    expect(envSchema.safeParse({ ...valid, NOTION_ENCRYPTION_KEY: 'zz' }).success).toBe(false);
    expect(envSchema.safeParse({ ...valid, NOTION_ENCRYPTION_KEY: 'g'.repeat(64) }).success).toBe(
      false,
    );
  });
});

describe('loadEnv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('vrátí naparsovaný env při platné konfiguraci', () => {
    const env = loadEnv({ ...valid, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('test');
  });

  it('při neplatné konfiguraci zaloguje a ukončí proces', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('exit');
    }) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => loadEnv({ JWT_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalled();
  });
});
