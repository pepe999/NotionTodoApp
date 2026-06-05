import type { FastifyReply } from 'fastify';
import type { AuthedUser } from '../auth/service';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser;
    sessionId?: string;
  }
  interface FastifyInstance {
    /** preHandler – ověří session cookie, jinak odpoví 401. */
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}
