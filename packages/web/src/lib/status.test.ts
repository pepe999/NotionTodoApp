import { describe, it, expect } from 'vitest';
import { STATUS_ORDER, statusMeta } from './status';

describe('status', () => {
  it('má 4 statusy ve správném pořadí', () => {
    expect(STATUS_ORDER).toEqual(['Todo', 'In Progress', 'Review', 'Done']);
  });

  it('statusMeta pokrývá všechny statusy', () => {
    for (const s of STATUS_ORDER) {
      expect(statusMeta[s]).toBeDefined();
      expect(statusMeta[s].label).toBeTruthy();
    }
  });
});
