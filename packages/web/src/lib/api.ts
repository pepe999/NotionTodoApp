/**
 * Fetch wrapper (PLAN.md 3.4): credentials: "include", typové chyby,
 * automatický logout při 401, retry s backoff jen pro idempotentní GET.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Zaregistruje akci při 401 (nastaví useAuth – invaliduje session + redirect). */
export function setUnauthorizedHandler(fn: UnauthorizedHandler): void {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Počet opakování pro idempotentní GET při síťové chybě / 5xx. */
  retries?: number;
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const init: RequestInit = { method, credentials: 'include' };
  if (opts.signal) init.signal = opts.signal;
  if (opts.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }

  const maxRetries = method === 'GET' ? (opts.retries ?? 2) : 0;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await fetch(path, init);

      if (res.status === 401) {
        onUnauthorized?.();
        throw new ApiError('Nepřihlášeno.', 401);
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await delay(2 ** attempt * 300);
        continue;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new ApiError(extractMessage(body) ?? res.statusText, res.status, body);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      // Síťovou chybu (TypeError z fetch) u GET zkusíme znovu; ApiError přebublá.
      if (err instanceof ApiError || attempt >= maxRetries) throw err;
      await delay(2 ** attempt * 300);
    }
  }
  throw lastErr;
}
