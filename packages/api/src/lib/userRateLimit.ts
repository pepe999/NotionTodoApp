import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Per-user rate limiter pro /api/* (PLAN.md 1.6).
 *
 * Běží jako preHandler AŽ PO autentizaci, takže klíčuje podle `req.user.id`
 * (chrání i uživatele za sdílenou NAT/VPN IP). Hrubý IP-based pre-auth limit
 * řeší @fastify/rate-limit na onRequest (před autentizací).
 *
 * In-memory fixed window – OK pro 1 instanci; při škálování přepni na Redis.
 */
export interface RateCheck {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Zbývající čas okna v ms. */
  resetMs: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Zaznamená požadavek pro klíč a vrátí stav limitu. */
  hit(key: string, now: number = Date.now()): RateCheck {
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return {
      ok: w.count <= this.max,
      limit: this.max,
      remaining: Math.max(0, this.max - w.count),
      resetMs: w.resetAt - now,
    };
  }

  /** Smaže expirovaná okna (volá se periodicky). */
  sweep(now: number = Date.now()): void {
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }

  /** Periodický úklid; timer je unref-ovaný. Vrací stop funkci. */
  startCleanup(intervalMs: number = this.windowMs): () => void {
    const timer = setInterval(() => this.sweep(), intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}

/**
 * Vytvoří preHandler, který aplikuje per-user limit. Při překročení odpoví 429
 * s `Retry-After` a JSON tělem; jinak doplní `RateLimit-*` hlavičky.
 */
/** preHandler aplikující per-user limit (viz makeUserRateLimit). */
export type RateLimitPreHandler = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function makeUserRateLimit(limiter: FixedWindowLimiter): RateLimitPreHandler {
  return async function userRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = req.user?.id ?? req.ip;
    const r = limiter.hit(key);
    const resetSec = Math.ceil(r.resetMs / 1000);
    reply.header('RateLimit-Limit', String(r.limit));
    reply.header('RateLimit-Remaining', String(r.remaining));
    reply.header('RateLimit-Reset', String(resetSec));
    if (!r.ok) {
      reply.header('Retry-After', String(resetSec));
      reply.status(429).send({
        error: 'TooManyRequests',
        message: `Překročen limit požadavků. Zkus to znovu za ${resetSec} s.`,
        retryAfter: resetSec,
      });
    }
  };
}
