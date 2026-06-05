import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import type { Env } from './env';
import { buildLoggerOptions } from './logger';
import type { DB } from './db/index';
import authPlugin from './plugins/auth';
import setupRoutes from './routes/setup';
import tasksRoutes from './routes/tasks';
import { NotionService } from './services/notion/service';
import { TokenCipher } from './crypto/tokenCrypto';

export interface BuildServerOptions {
  /** Volitelné DB připojení – využije /health pro kontrolu stavu. */
  db?: DB;
  /** Injektovatelná Notion služba (testy); jinak se vytvoří sdílený singleton. */
  notion?: NotionService;
  /** Injektovatelná šifra tokenu (testy); jinak z NOTION_ENCRYPTION_KEY. */
  cipher?: TokenCipher;
}

const MAX_BODY_BYTES = 256 * 1024; // ochrana proti DoS přes velké payloady (PLAN.md 1.6)

export async function buildServer(
  env: Env,
  opts: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(env),
    trustProxy: true, // za Traefikem – respektuj X-Forwarded-* (rate limiting v 1.6)
    bodyLimit: MAX_BODY_BYTES,
    disableRequestLogging: env.NODE_ENV === 'test',
  });

  // --- Bezpečnostní hlavičky (helmet) ---
  // CSP a HSTS jen v produkci; v devu je CSP vypnutá kvůli Swagger UI (/docs).
  const isProd = env.NODE_ENV === 'production';
  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
          },
        }
      : false,
    hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
  });

  // --- CORS: jen povolený frontend origin ---
  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // --- Cookies (auth flow ve Fázi 1.3) ---
  await app.register(cookie, {});

  // --- Rate limiting (globální základ; dvouúrovňové ladění ve Fázi 1.6) ---
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      error: 'TooManyRequests',
      message: `Překročen limit požadavků. Zkus to znovu za ${context.after}.`,
      retryAfter: context.ttl,
    }),
  });

  // --- OpenAPI dokumentace (jen mimo produkci – /docs nevystavujeme veřejně) ---
  if (!isProd) {
    await app.register(swagger, {
      openapi: {
        info: { title: 'NotionTodoApp API', version: '0.1.0' },
        tags: [
          { name: 'tasks', description: 'Správa úkolů (Notion)' },
          { name: 'setup', description: 'Konfigurace Notion integrace' },
        ],
      },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  // --- Sanitizovaný error handler (žádný stack trace v produkci) ---
  // Registrace MUSÍ být před routami, aby se na ně tento handler aplikoval.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err }, 'request error');

    if (err.validation || err instanceof ZodError) {
      reply.status(400).send({
        error: 'ValidationError',
        message: 'Neplatný vstup.',
        details: err instanceof ZodError ? err.issues : err.validation,
      });
      return;
    }

    const status = err.statusCode ?? 500;
    const exposeMessage = !isProd || status < 500;
    reply.status(status).send({
      error: status >= 500 ? 'InternalServerError' : err.name,
      message: exposeMessage ? err.message : 'Interní chyba serveru.',
    });
  });

  // --- Auth (OAuth, sessions, /auth/*) + Notion setup/tasks – vyžaduje DB ---
  if (opts.db) {
    await app.register(authPlugin, { db: opts.db, env });
    const cipher = opts.cipher ?? new TokenCipher(env.NOTION_ENCRYPTION_KEY);
    const notion = opts.notion ?? new NotionService();
    await app.register(setupRoutes, { db: opts.db, cipher, notion });
    await app.register(tasksRoutes, { db: opts.db, cipher, notion });
  }

  // --- Health check (rozšířeno v 1.8) ---
  app.get('/health', async () => {
    let db = 'unknown';
    if (opts.db) {
      try {
        opts.db.prepare('SELECT 1').get();
        db = 'connected';
      } catch {
        db = 'error';
      }
    }
    return {
      status: 'ok',
      uptime: process.uptime(),
      db,
      version: process.env.npm_package_version ?? '0.1.0',
    };
  });

  return app;
}
