import { format, isBefore, parseISO, startOfDay } from 'date-fns';

/**
 * Práce s časem (PLAN.md 3.12). Due/Timeline z Notionu jsou date-only
 * (YYYY-MM-DD) – parsujeme jako LOKÁLNÍ půlnoc, ne UTC, aby nedošlo k posunu
 * o ±1 den. Datetime hodnoty (s časem) parsujeme přes parseISO.
 */
export function parseNotionDate(s: string): Date {
  if (s.length > 10) return parseISO(s);
  const parts = s.split('-');
  const y = Number(parts[0] ?? '1970');
  const m = Number(parts[1] ?? '1');
  const d = Number(parts[2] ?? '1');
  return new Date(y, m - 1, d);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '';
  return format(parseNotionDate(s), 'd. M. yyyy');
}

export function isOverdue(due: string | null | undefined, status: string): boolean {
  if (!due || status === 'Done') return false;
  return isBefore(startOfDay(parseNotionDate(due)), startOfDay(new Date()));
}

/** ISO date-only z Date (pro odeslání do API jako Due). */
export function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
