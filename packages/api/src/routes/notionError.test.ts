import { describe, it, expect } from 'vitest';
import type { FastifyReply } from 'fastify';
import { handleNotionError } from './notionError';
import { NotionApiError } from '../services/notion/client';
import { InvalidNotionIdError } from '../services/notion/ids';

interface Captured {
  statusCode: number;
  body: unknown;
}

function fakeReply(): { reply: FastifyReply; captured: Captured } {
  const captured: Captured = { statusCode: 0, body: undefined };
  const reply = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    send(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as FastifyReply;
  return { reply, captured };
}

describe('handleNotionError', () => {
  it('InvalidNotionIdError → 400 InvalidNotionId', () => {
    const { reply, captured } = fakeReply();
    handleNotionError(reply, new InvalidNotionIdError('x'));
    expect(captured.statusCode).toBe(400);
    expect((captured.body as { error: string }).error).toBe('InvalidNotionId');
  });

  it('NotionApiError 401/403 → 400 NotionAuth', () => {
    for (const status of [401, 403]) {
      const { reply, captured } = fakeReply();
      handleNotionError(reply, new NotionApiError('x', status));
      expect(captured.statusCode).toBe(400);
      expect((captured.body as { error: string }).error).toBe('NotionAuth');
    }
  });

  it('NotionApiError 404 → 404 NotionNotFound', () => {
    const { reply, captured } = fakeReply();
    handleNotionError(reply, new NotionApiError('x', 404));
    expect(captured.statusCode).toBe(404);
    expect((captured.body as { error: string }).error).toBe('NotionNotFound');
  });

  it('NotionApiError 500 → 502 NotionUpstream', () => {
    const { reply, captured } = fakeReply();
    handleNotionError(reply, new NotionApiError('x', 500));
    expect(captured.statusCode).toBe(502);
    expect((captured.body as { error: string }).error).toBe('NotionUpstream');
  });

  it('neznámou chybu přehodí dál', () => {
    const { reply } = fakeReply();
    expect(() => handleNotionError(reply, new Error('boom'))).toThrow('boom');
  });
});
