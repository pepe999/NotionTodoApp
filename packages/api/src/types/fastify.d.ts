import type { FastifyReply } from 'fastify';
import type { AuthedUser } from '../auth/service';
import type { NotionContext } from '../services/notion/service';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser;
    sessionId?: string;
    /** Notion kontext uživatele (token + databáze) – nastaví preHandler u /api/tasks. */
    notionCtx?: NotionContext;
  }
  interface FastifyInstance {
    /** preHandler – ověří session cookie, jinak odpoví 401. */
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}
