import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimitQueue } from './rateQueue';

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimitQueue', () => {
  it('vrací výsledky úloh', async () => {
    const q = new RateLimitQueue({ concurrency: 5, minIntervalMs: 0 });
    const results = await Promise.all([
      q.run(async () => 1),
      q.run(async () => 2),
      q.run(async () => 3),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('propaguje chyby', async () => {
    const q = new RateLimitQueue({ concurrency: 1, minIntervalMs: 0 });
    await expect(q.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('respektuje concurrency (max souběžných)', async () => {
    const q = new RateLimitQueue({ concurrency: 2, minIntervalMs: 0 });
    let active = 0;
    let peak = 0;
    const make = () =>
      q.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 10));
        active -= 1;
      });
    await Promise.all([make(), make(), make(), make(), make()]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('drží minimální rozestup mezi starty (rate limit)', async () => {
    vi.useFakeTimers();
    const q = new RateLimitQueue({ concurrency: 10, minIntervalMs: 350 });
    const starts: number[] = [];
    const task = () =>
      q.run(async () => {
        starts.push(Date.now());
      });
    void task();
    void task();
    void task();

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(1); // první hned
    await vi.advanceTimersByTimeAsync(350);
    expect(starts).toHaveLength(2); // druhý po rozestupu
    await vi.advanceTimersByTimeAsync(350);
    expect(starts).toHaveLength(3);
  });
});
