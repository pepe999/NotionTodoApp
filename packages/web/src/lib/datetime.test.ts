import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseNotionDate, formatDate, isOverdue, toDateOnly } from './datetime';

describe('datetime', () => {
  afterEach(() => vi.useRealTimers());

  it('parseNotionDate parsuje date-only jako lokální půlnoc (žádný posun)', () => {
    const d = parseNotionDate('2026-06-10');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // červen
    expect(d.getDate()).toBe(10);
  });

  it('formatDate formátuje česky', () => {
    expect(formatDate('2026-06-10')).toBe('10. 6. 2026');
    expect(formatDate(null)).toBe('');
  });

  it('toDateOnly vrátí YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2026, 5, 10))).toBe('2026-06-10');
  });

  it('isOverdue: minulé Todo je po termínu, Done a prázdné ne', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(isOverdue('2026-06-10', 'Todo')).toBe(true);
    expect(isOverdue('2026-06-10', 'Done')).toBe(false);
    expect(isOverdue('2026-06-20', 'Todo')).toBe(false);
    expect(isOverdue(null, 'Todo')).toBe(false);
  });
});
