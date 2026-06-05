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
import { FixedWindowLimiter, makeUserRateLimit } from './lib/userRateLimit';

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
    // Přesný počet proxy hopů (za Traefikem 1) – klientská IP z X-Forwarded-For
    // se bere jen tolik hopů zpět, takže ji klient nemůže podvrhnout (PLAN.md 1.6).
    trustProxy: env.TRUST_PROXY_HOPS,
    bodyLimit: MAX_BODY_BYTES,
    // Další DoS limity: timeout spojení a maximální délka URL parametru.
    connectionTimeout: 30_000,
    routerOptions: { maxParamLength: 256 },
    disableRequestLogging: env.NODE_ENV === 'test',
  });

  // --- Bezpečnostní hlavičky (helmet) – PLAN.md 1.7 ---
  // CSP a HSTS jen v produkci; v devu je CSP vypnutá kvůli Swagger UI (/docs).
  const isProd = env.NODE_ENV === 'production';
  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          // useDefaults (helmet) ponechá bezpečné výchozí direktivy
          // (script-src-attr 'none', upgrade-insecure-requests, …); níže jen
          // zpřísňujeme klíčové. styleSrc bez 'unsafe-inline' – Tailwind v4
          // generuje statické CSS.
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
          },
        }
      : false,
    hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    // API a web jsou na stejné doméně (různé subdomény) → same-site.
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  // Permissions-Policy (helmet ji nenastavuje) – zakázat citlivé browser API.
  const PERMISSIONS_POLICY =
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), ' +
    'gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()';
  app.addHook('onRequest', async (_req, reply) => {
    reply.header('Permissions-Policy', PERMISSIONS_POLICY);
  });

  // --- CORS: jen povolený frontend origin (nereflektuje libovolný origin) ---
  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400, // cache preflightu na 24 h
  });

  // --- Cookies (auth flow ve Fázi 1.3) ---
  await app.register(cookie, {});

  // --- Rate limiting, úroveň 1: per-IP na onRequest (PŘED autentizací) ---
  // Hrubý flood guard pro všechny routy. /auth/* má přísnější limit, /api/*
  // dostane navíc per-user limit (úroveň 2) až po ověření session. /health je
  // vyňato (sondy load balanceru).
  await app.register(rateLimit, {
    max: (req) =>
      req.url.startsWith('/auth/') ? env.RATE_LIMIT_AUTH_MAX : env.RATE_LIMIT_API_IP_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    allowList: (req) => req.url === '/health',
    enableDraftSpec: true, // RateLimit-* hlavičky
    // @fastify/rate-limit VYHAZUJE výsledek builderu → musí to být Error se
    // statusCode (jinak ho setErrorHandler vyhodnotí jako 500). retryAfter
    // si přečte 429 větev error handleru.
    errorResponseBuilder: (_req, context) => {
      const retryAfter = Math.ceil(context.ttl / 1000);
      return Object.assign(
        new Error(`Překročen limit požadavků. Zkus to znovu za ${retryAfter} s.`),
        { statusCode: context.statusCode, retryAfter },
      );
    },
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

    // Rate limit (vyhozený @fastify/rate-limit) – jednotný tvar s per-user limitem.
    if (err.statusCode === 429) {
      const retryAfter = (err as FastifyError & { retryAfter?: number }).retryAfter;
      reply.status(429).send({ error: 'TooManyRequests', message: err.message, retryAfter });
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

    // Rate limiting, úroveň 2: per-user limit pro /api/* (běží až po auth).
    const apiLimiter = new FixedWindowLimiter(
      env.RATE_LIMIT_API_USER_MAX,
      env.RATE_LIMIT_WINDOW_MS,
    );
    const stopApiLimiterCleanup = apiLimiter.startCleanup();
    app.addHook('onClose', () => stopApiLimiterCleanup());
    const apiRateLimit = makeUserRateLimit(apiLimiter);

    await app.register(setupRoutes, { db: opts.db, cipher, notion, apiRateLimit });
    await app.register(tasksRoutes, { db: opts.db, cipher, notion, apiRateLimit });
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
