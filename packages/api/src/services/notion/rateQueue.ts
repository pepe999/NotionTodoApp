/**
 * Sdílená fronta pro volání Notion API (PLAN.md 1.4).
 *
 * Notion má rate limit ~3 req/s. Všechna volání jdou přes JEDNU instanci téhle
 * fronty (ne per-request), která drží:
 *  - `concurrency` – kolik requestů smí běžet souběžně,
 *  - `minIntervalMs` – minimální rozestup mezi STARTY requestů (≈ 1000/3 ms).
 *
 * Použity `setTimeout`y, takže se fronta dá v testech řídit fake timery.
 */
export interface RateLimitQueueOptions {
  concurrency: number;
  /** Minimální rozestup mezi starty požadavků v ms. */
  minIntervalMs: number;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimitQueue {
  private readonly pending: Array<() => void> = [];
  private active = 0;
  private lastDispatch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: RateLimitQueueOptions) {}

  /** Zařadí úlohu do fronty; vrátí promise s jejím výsledkem. */
  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.active += 1;
        this.lastDispatch = Date.now();
        void task()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.pump();
          });
      });
      this.pump();
    });
  }

  private pump(): void {
    if (this.timer) return; // už čekáme na další okno
    if (this.active >= this.opts.concurrency) return;
    if (this.pending.length === 0) return;

    const wait = Math.max(0, this.lastDispatch + this.opts.minIntervalMs - Date.now());
    if (wait > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, wait);
      return;
    }

    const next = this.pending.shift();
    if (next) next();
    this.pump(); // zkus zařadit další (respektuje concurrency i rozestup)
  }
}
