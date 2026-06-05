import { describe, it, expect } from 'vitest';
import { isValidNotionId, normalizeNotionId, parseDatabaseId, InvalidNotionIdError } from './ids';

const COMPACT = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';
const DASHED = '274d8f1e-2a3b-4c5d-6e7f-8091a2b3c4d5';

describe('notion ids', () => {
  it('akceptuje ID s pomlčkami i bez', () => {
    expect(isValidNotionId(COMPACT)).toBe(true);
    expect(isValidNotionId(DASHED)).toBe(true);
    expect(isValidNotionId('not-an-id')).toBe(false);
    expect(isValidNotionId('123')).toBe(false);
  });

  it('normalizuje na dashed UUID', () => {
    expect(normalizeNotionId(COMPACT)).toBe(DASHED);
    expect(normalizeNotionId(DASHED)).toBe(DASHED);
  });

  it('vyhodí InvalidNotionIdError u neplatného vstupu (SSRF ochrana)', () => {
    expect(() => normalizeNotionId('../../etc/passwd')).toThrow(InvalidNotionIdError);
    expect(() => normalizeNotionId('xyz')).toThrow(InvalidNotionIdError);
  });

  it('vytáhne ID z Notion URL', () => {
    const url = `https://www.notion.so/myworkspace/Tasks-${COMPACT}?v=abcdef`;
    expect(parseDatabaseId(url)).toBe(DASHED);
  });

  it('parseDatabaseId zvládne i samotné ID', () => {
    expect(parseDatabaseId(DASHED)).toBe(DASHED);
    expect(parseDatabaseId(`  ${COMPACT}  `)).toBe(DASHED);
  });

  it('parseDatabaseId vyhodí chybu bez ID', () => {
    expect(() => parseDatabaseId('https://www.notion.so/no-id-here')).toThrow(InvalidNotionIdError);
  });
});
