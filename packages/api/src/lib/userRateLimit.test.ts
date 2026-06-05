import { describe, it, expect } from 'vitest';
import { FixedWindowLimiter } from './userRateLimit';

describe('FixedWindowLimiter', () => {
  it('povolí požadavky do limitu, pak blokuje', () => {
    const l = new FixedWindowLimiter(2, 1000);
    expect(l.hit('u', 0).ok).toBe(true);
    expect(l.hit('u', 0).ok).toBe(true);
    const third = l.hit('u', 0);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('počítá remaining', () => {
    const l = new FixedWindowLimiter(3, 1000);
    expect(l.hit('u', 0).remaining).toBe(2);
    expect(l.hit('u', 0).remaining).toBe(1);
  });

  it('resetuje okno po vypršení', () => {
    const l = new FixedWindowLimiter(1, 1000);
    expect(l.hit('u', 0).ok).toBe(true);
    expect(l.hit('u', 500).ok).toBe(false);
    expect(l.hit('u', 1000).ok).toBe(true); // nové okno
  });

  it('odděluje klíče (per-user)', () => {
    const l = new FixedWindowLimiter(1, 1000);
    expect(l.hit('a', 0).ok).toBe(true);
    expect(l.hit('b', 0).ok).toBe(true);
    expect(l.hit('a', 0).ok).toBe(false);
  });

  it('sweep smaže expirovaná okna', () => {
    const l = new FixedWindowLimiter(5, 1000);
    l.hit('a', 0);
    l.hit('b', 0);
    l.sweep(2000);
    expect(l.hit('a', 2000).remaining).toBe(4); // counter resetnut
  });
});
