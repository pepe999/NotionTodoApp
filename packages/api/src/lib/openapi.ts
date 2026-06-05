import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Převede Zod schéma na inline JSON Schema pro @fastify/swagger (PLAN.md 1.5).
 * `$refStrategy: 'none'` vše inlinuje (Fastify/swagger nepracuje dobře s $ref na
 * společné definice). `$schema` klíč odstraníme – Fastify ho v route schématu
 * nepotřebuje.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}

/** Obalí schéma do JSON Schema pole (pro list endpointy). */
export function arrayOf(schema: z.ZodType): Record<string, unknown> {
  return { type: 'array', items: toJsonSchema(schema) };
}
