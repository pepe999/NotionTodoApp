import { describe, it, expect } from 'vitest';
import { TtlCache } from './cache';

describe('TtlCache', () => {
  it('vrátí uloženou hodnotu před expirací', () => {
    const c = new TtlCache<number>(1000);
    c.set('a', 42, 0);
    expect(c.get('a', 500)).toBe(42);
  });

  it('po TTL vrátí undefined', () => {
    const c = new TtlCache<number>(1000);
    c.set('a', 42, 0);
    expect(c.get('a', 1000)).toBeUndefined();
    expect(c.get('a', 1500)).toBeUndefined();
  });

  it('delete invaliduje klíč (write-through)', () => {
    const c = new TtlCache<number>(1000);
    c.set('a', 1, 0);
    c.delete('a');
    expect(c.get('a', 0)).toBeUndefined();
  });

  it('eviktuje nejstarší při překročení kapacity', () => {
    const c = new TtlCache<number>(10_000, 2);
    c.set('a', 1, 0);
    c.set('b', 2, 0);
    c.set('c', 3, 0); // vytlačí 'a'
    expect(c.get('a', 0)).toBeUndefined();
    expect(c.get('b', 0)).toBe(2);
    expect(c.get('c', 0)).toBe(3);
  });

  it('čtení obnoví LRU pořadí', () => {
    const c = new TtlCache<number>(10_000, 2);
    c.set('a', 1, 0);
    c.set('b', 2, 0);
    c.get('a', 0); // 'a' je teď naposledy použité
    c.set('c', 3, 0); // vytlačí 'b'
    expect(c.get('b', 0)).toBeUndefined();
    expect(c.get('a', 0)).toBe(1);
  });
});
