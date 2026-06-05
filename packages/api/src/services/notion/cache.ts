/**
 * Jednoduchá per-user TTL cache (PLAN.md 1.4).
 *
 * Cílem je drasticky snížit počet volání Notion při 30s pollingu více klientů –
 * `getTasks` se cachuje na ~20 s, mutace jsou write-through (po zápisu invaliduj).
 * LRU eviction přes pořadí vkládání v `Map` (re-insert na čtení = "recently used").
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private readonly store = new Map<string, Entry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
  ) {}

  get(key: string, now: number = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    // označ jako naposledy použité (přesun na konec pořadí).
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, now: number = Date.now()): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
    if (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
