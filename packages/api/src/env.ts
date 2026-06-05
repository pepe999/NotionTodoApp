import { z } from 'zod';

/**
 * Validace environment proměnných při startu (PLAN.md 1.1).
 * Server bez povinných proměnných odmítne nastartovat s popisnou chybou.
 *
 * `loadEnv()` zavolej v bootstrapu (index.ts) – při chybě ukončí proces.
 * `envSchema` je exportováno pro testy (parsování bez side-efektů).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/app.sqlite'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Povinné bezpečnostní klíče.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET musí mít alespoň 32 znaků'),
  NOTION_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'NOTION_ENCRYPTION_KEY musí být 32 bajtů v hex (64 znaků)'),

  // Google OAuth – povinné až ve Fázi 1.3 (zatím volitelné pro inkrementální vývoj).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),

  // Rate limiting (PLAN.md 1.6). Počet proxy hopů před appkou – za Traefikem 1.
  // Důležité pro bezpečné určení klientské IP (ne spoofovatelné z X-Forwarded-For).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(120), // per IP, /auth/*
  RATE_LIMIT_API_IP_MAX: z.coerce.number().int().positive().default(600), // per IP, pre-auth flood guard
  RATE_LIMIT_API_USER_MAX: z.coerce.number().int().positive().default(300), // per user ID, /api/*
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Záměrně přes console (logger ještě nemusí existovat) – pak ukončíme proces.
    console.error(`\n❌ Neplatná konfigurace prostředí:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}
