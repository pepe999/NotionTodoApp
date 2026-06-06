import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('spojí třídy a vynechá falsy hodnoty', () => {
    expect(cn('a', null, undefined, '', 'c')).toBe('a c');
  });

  it('vyřeší konflikt Tailwindu (poslední vyhrává)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
