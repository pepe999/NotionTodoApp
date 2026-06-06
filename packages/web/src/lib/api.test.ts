import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, setUnauthorizedHandler } from './api';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(() => {});
});

describe('apiFetch', () => {
  it('vrátí JSON při 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonRes({ a: 1 })),
    );
    expect(await apiFetch('/x')).toEqual({ a: 1 });
  });

  it('204 vrátí undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(await apiFetch('/x', { method: 'DELETE' })).toBeUndefined();
  });

  it('4xx vyhodí ApiError s message z těla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonRes({ message: 'Zlé' }, 400)),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 400, message: 'Zlé' });
  });

  it('401 zavolá unauthorized handler', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonRes({}, 401)),
    );
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('GET opakuje při 500 a pak uspěje', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({}, 500))
      .mockResolvedValueOnce(jsonRes({ ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await apiFetch('/x', { retries: 1 })).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
  });
});
