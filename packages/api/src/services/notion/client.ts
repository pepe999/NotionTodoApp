import { RateLimitQueue, delay } from './rateQueue';

/**
 * Nízkoúrovňový Notion API klient (PLAN.md 1.4).
 *
 * - Base URL je HARDCODED (žádný user input → ochrana proti SSRF). Volající
 *   skládá `path` jen z konstant a předem validovaných ID (viz ids.ts).
 * - Všechna volání jdou přes sdílenou rate-limit frontu (~3 req/s).
 * - 429 → exponenciální backoff s respektem k `Retry-After`.
 * - Každý request má 10s timeout přes AbortSignal.
 */
const NOTION_BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

export interface NotionClientOptions {
  /** Injektovatelný fetch (testy). */
  fetchImpl?: typeof fetch;
  /** Sdílená fronta – ve výchozím stavu ~3 req/s. */
  queue?: RateLimitQueue;
}

export class NotionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

export class NotionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly queue: RateLimitQueue;

  constructor(opts: NotionClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.queue = opts.queue ?? new RateLimitQueue({ concurrency: 3, minIntervalMs: 350 });
  }

  /** Provede request přes frontu. `path` musí začínat `/` a obsahovat jen validovaná ID. */
  request<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
    return this.queue.run(() => this.execute<T>(token, method, path, body, 0));
  }

  private async execute<T>(
    token: string,
    method: string,
    path: string,
    body: unknown,
    attempt: number,
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    };
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await this.fetchImpl(`${NOTION_BASE_URL}${path}`, init);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await delay(backoffMs);
      return this.execute<T>(token, method, path, body, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new NotionApiError(`Notion API ${res.status}: ${text.slice(0, 200)}`, res.status);
    }

    return (await res.json()) as T;
  }
}
