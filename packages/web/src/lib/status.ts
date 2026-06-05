import type { TaskStatus } from '@notiontodoapp/shared';

export const STATUS_ORDER: readonly TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Done'];

interface StatusMeta {
  label: string;
  /** Tečka u sloupce. */
  dot: string;
  /** Badge třídy s kontrastem ≥ 4.5:1 (PLAN.md 3.12). */
  badge: string;
}

export const statusMeta: Record<TaskStatus, StatusMeta> = {
  Todo: { label: 'Todo', dot: 'bg-zinc-400', badge: 'bg-zinc-200 text-zinc-800' },
  'In Progress': { label: 'In Progress', dot: 'bg-blue-500', badge: 'bg-blue-200 text-blue-900' },
  Review: { label: 'Review', dot: 'bg-amber-500', badge: 'bg-amber-200 text-amber-900' },
  Done: { label: 'Done', dot: 'bg-green-500', badge: 'bg-green-200 text-green-900' },
};
