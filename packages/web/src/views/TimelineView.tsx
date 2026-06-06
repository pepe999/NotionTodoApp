import { useMemo } from 'react';
import { addDays, differenceInCalendarDays, format, max, min, startOfDay } from 'date-fns';
import { useFilteredTasks } from '@/hooks/useTasks';
import { useTaskStore } from '@/store/taskStore';
import { parseNotionDate } from '@/lib/datetime';
import { statusMeta } from '@/lib/status';
import { cn } from '@/lib/utils';

const DAY_WIDTH = 36;
const ROW_HEIGHT = 36;

/**
 * Gantt / časová osa (PLAN.md 3.6). Read-only zobrazení barů podle Timeline
 * (start–end) nebo Due (jeden den), s dnešní linkou. Drag/resize a šipky
 * závislostí jsou plánované rozšíření.
 */
export default function TimelineView() {
  const { tasks } = useFilteredTasks();
  const openTask = useTaskStore((s) => s.openTask);

  const rows = useMemo(() => {
    return tasks
      .filter((t) => !t.parentId)
      .map((t) => {
        if (t.timeline) {
          return {
            task: t,
            start: parseNotionDate(t.timeline.start),
            end: parseNotionDate(t.timeline.end),
          };
        }
        if (t.dueDate) {
          const d = parseNotionDate(t.dueDate);
          return { task: t, start: d, end: d };
        }
        return null;
      })
      .filter((r): r is { task: (typeof tasks)[number]; start: Date; end: Date } => r !== null);
  }, [tasks]);

  if (rows.length === 0) {
    return (
      <p className="py-24 text-center text-zinc-500">
        Žádné úkoly s termínem nebo časovým rozpětím.
      </p>
    );
  }

  const today = startOfDay(new Date());
  const dates = rows.flatMap((r) => [r.start, r.end]);
  const rangeStart = startOfDay(min([...dates, today]));
  const rangeEnd = max([...dates, addDays(today, 7)]);
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
  const width = totalDays * DAY_WIDTH;
  const todayOffset = differenceInCalendarDays(today, rangeStart) * DAY_WIDTH;

  return (
    <div className="overflow-auto p-4">
      <div style={{ width }} className="relative">
        {/* Osa dnů */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = addDays(rangeStart, i);
            return (
              <div
                key={i}
                style={{ width: DAY_WIDTH }}
                className="shrink-0 border-l border-zinc-100 py-1 text-center text-[10px] text-zinc-400 dark:border-zinc-800"
              >
                {format(d, 'd')}
              </div>
            );
          })}
        </div>

        {/* Dnešní linka */}
        <div
          className="pointer-events-none absolute top-0 z-10 w-px bg-red-500"
          style={{ left: todayOffset + DAY_WIDTH / 2, height: (rows.length + 1) * ROW_HEIGHT }}
          aria-hidden
        />

        {/* Řádky */}
        {rows.map((r) => {
          const left = differenceInCalendarDays(r.start, rangeStart) * DAY_WIDTH;
          const span = (differenceInCalendarDays(r.end, r.start) + 1) * DAY_WIDTH;
          return (
            <div key={r.task.id} className="relative" style={{ height: ROW_HEIGHT }}>
              <button
                type="button"
                onClick={() => openTask(r.task.id)}
                style={{ left, width: Math.max(span - 4, DAY_WIDTH - 4) }}
                className={cn(
                  'absolute top-1.5 flex h-6 items-center truncate rounded px-2 text-xs text-white',
                  statusMeta[r.task.status].dot,
                )}
                title={r.task.name}
              >
                {r.task.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
