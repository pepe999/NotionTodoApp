import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { DB } from '../db/index';
import type { Env } from '../env';
import { getUserById, deleteUser } from '../db/users';
import { getNotionConfig } from '../db/notionConfigs';
import { recordAudit, getAuditLogForUser } from '../db/auditLog';
import { SESSION_COOKIE, clearCookieOptions } from '../auth/cookies';
import type { RateLimitPreHandler } from '../lib/userRateLimit';

export interface AccountRoutesOptions {
  db: DB;
  env: Env;
  /** Per-user rate limit pro /api/* (úroveň 2; běží po auth). */
  apiRateLimit: RateLimitPreHandler;
}

const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (app, opts) => {
  const { db, env, apiRateLimit } = opts;
  const preHandler = [app.authenticate, apiRateLimit];

  // --- GDPR export: všechna osobní data uživatele (bez plaintext tokenu) ---
  app.get('/api/account/export', { preHandler }, async (req, reply) => {
    const userId = req.user!.id;
    const user = getUserById(db, userId);
    const cfg = getNotionConfig(db, userId);
    const audit = getAuditLogForUser(db, userId);

    recordAudit(db, {
      userId,
      event: 'account_export',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.send({
      exportedAt: Date.now(),
      profile: user
        ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url }
        : null,
      // Notion token se NIKDY neexportuje – jen metadata konfigurace.
      notionConfig: cfg
        ? {
            databaseId: cfg.database_id,
            validatedAt: cfg.validated_at,
            createdAt: cfg.created_at,
            updatedAt: cfg.updated_at,
          }
        : null,
      auditLog: audit.map((a) => ({
        event: a.event,
        ip: a.ip,
        userAgent: a.user_agent,
        createdAt: a.created_at,
      })),
    });
  });

  // --- GDPR výmaz účtu (CASCADE sessions + notion_configs) ---
  app.delete('/api/account', { preHandler }, async (req, reply) => {
    const userId = req.user!.id;
    // Audit zaznamenáme PŘED výmazem; ON DELETE SET NULL ho pak anonymizuje.
    recordAudit(db, {
      userId,
      event: 'account_delete',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    deleteUser(db, userId);
    reply.clearCookie(SESSION_COOKIE, clearCookieOptions(env));
    return reply.send({ ok: true });
  });
};

export default fp(accountRoutes, { name: 'account-routes' });
