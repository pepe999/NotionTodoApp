import type { FastifyServerOptions } from 'fastify';
import type { Env } from './env';

/**
 * Pino logger options pro Fastify.
 * - Notion token / Authorization / cookie se NIKDY nelogují (redact).
 * - Pretty výstup jen v developmentu (pino-pretty je devDependency).
 * - V testech je logování tiché.
 */
export function buildLoggerOptions(env: Env): NonNullable<FastifyServerOptions['logger']> {
  const redactPaths = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'body.token',
    'body.integration_token',
    '*.integration_token',
    '*.integration_token_encrypted',
  ];

  if (env.NODE_ENV === 'test') {
    return false;
  }

  return {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  };
}
