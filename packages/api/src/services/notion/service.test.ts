import { describe, it, expect, vi } from 'vitest';
import { NotionService, type NotionContext } from './service';
import { NotionClient } from './client';
import { RateLimitQueue } from './rateQueue';

const DB_ID = '274d8f1e2a3b4c5d6e7f8091a2b3c4d5';
const ctx: NotionContext = { userId: 'u1', token: 'secret_token', databaseId: DB_ID };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Vytvoří službu s mock fetchem (bez rozestupů ve frontě). */
function makeService(fetchImpl: typeof fetch) {
  const client = new NotionClient({
    fetchImpl,
    queue: new RateLimitQueue({ concurrency: 5, minIntervalMs: 0 }),
  });
  return new NotionService({ client });
}

function pageFixture(id: string, name: string) {
  return {
    id,
    last_edited_time: '2026-06-01T00:00:00.000Z',
    properties: { Name: { type: 'title', title: [{ plain_text: name }] } },
  };
}

describe('NotionService', () => {
  it('validateDatabase volá GET /databases/{id} s normalizovaným ID', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ properties: { Name: { type: 'title' } } }),
    ) as unknown as typeof fetch;
    const service = makeService(fetchMock);

    const result = await service.validateDatabase('tok', DB_ID);

    expect(result.valid).toBe(false); // jen Name → ostatní chybí
    const mock = fetchMock as unknown as ReturnType<typeof vi.fn>;
    const url = mock.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.notion.com/v1/databases/274d8f1e-2a3b-4c5d-6e7f-8091a2b3c4d5');
  });

  it('getTask načte jednu stránku přes GET /pages/{id}', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(pageFixture('p1', 'Detail')));
    const service = makeService(fetchMock as unknown as typeof fetch);

    const task = await service.getTask(ctx, DB_ID);
    expect(task.name).toBe('Detail');
    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.notion.com/v1/pages/274d8f1e-2a3b-4c5d-6e7f-8091a2b3c4d5');
  });

  it('getTasks projde celé stránkování a pak cachuje', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ results: [pageFixture('p1', 'A')], has_more: true, next_cursor: 'c1' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ results: [pageFixture('p2', 'B')], has_more: false, next_cursor: null }),
      );
    const service = makeService(fetchMock as unknown as typeof fetch);

    const tasks = await service.getTasks(ctx);
    expect(tasks.map((t) => t.name)).toEqual(['A', 'B']);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // druhý request: cache → žádné další volání fetch
    const cached = await service.getTasks(ctx);
    expect(cached.map((t) => t.name)).toEqual(['A', 'B']);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // start_cursor předán ve druhém volání
    const secondInit = fetchMock.mock.calls[1]?.[1] as { body: string };
    const secondBody = JSON.parse(secondInit.body) as { start_cursor?: string };
    expect(secondBody.start_cursor).toBe('c1');
  });

  it('createTask invaliduje cache (getTasks znovu volá Notion)', async () => {
    // mockImplementation → čerstvá Response na každé volání (tělo lze číst jen jednou).
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results: [], has_more: false, next_cursor: null }),
    );
    const service = makeService(fetchMock as unknown as typeof fetch);

    await service.getTasks(ctx); // naplní cache (1 volání)
    await service.createTask(ctx, {
      name: 'Nový',
      status: 'Todo',
      tags: [],
      ownerIds: [],
      dependsOnIds: [],
    });

    const callsBefore = fetchMock.mock.calls.length;
    await service.getTasks(ctx); // cache invalidována → další volání
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it('chybový status vyhodí NotionApiError', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'unauthorized' }, 401));
    const service = makeService(fetchMock as unknown as typeof fetch);
    await expect(service.validateDatabase('bad', DB_ID)).rejects.toMatchObject({ status: 401 });
  });
});
