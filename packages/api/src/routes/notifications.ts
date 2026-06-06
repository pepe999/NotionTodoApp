import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { deviceTokenRegisterSchema } from '@notiontodoapp/shared';
import { z } from 'zod';
import type { DB } from '../db/index';
import { registerDeviceToken, removeDeviceToken } from '../db/deviceTokens';
import type { RateLimitPreHandler } from '../lib/userRateLimit';

export interface NotificationsRoutesOptions {
  db: DB;
  apiRateLimit: RateLimitPreHandler;
}

const unregisterSchema = z.object({ token: z.string().min(1) });

const notificationsRoutes: FastifyPluginAsync<NotificationsRoutesOptions> = async (app, opts) => {
  const { db, apiRateLimit } = opts;
  const preHandler = [app.authenticate, apiRateLimit];

  // Registrace APNs device tokenu (PLAN.md 5.8).
  app.post('/api/notifications/register', { preHandler }, async (req, reply) => {
    const input = deviceTokenRegisterSchema.parse(req.body);
    registerDeviceToken(db, {
      userId: req.user!.id,
      token: input.token,
      platform: input.platform,
    });
    return reply.status(201).send({ ok: true });
  });

  app.delete('/api/notifications/register', { preHandler }, async (req, reply) => {
    const input = unregisterSchema.parse(req.body);
    removeDeviceToken(db, input.token);
    return reply.send({ ok: true });
  });
};

export default fp(notificationsRoutes, { name: 'notifications-routes' });
