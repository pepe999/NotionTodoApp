import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task } from '@notiontodoapp/shared';
import { useFilteredTasks, useUpdateTask } from '@/hooks/useTasks';
import { useTaskStore } from '@/store/taskStore';
import { parseNotionDate, toDateOnly } from '@/lib/datetime';
import { statusMeta } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function TaskPill({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        'block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-white',
        statusMeta[task.status].dot,
        isDragging && 'opacity-40',
      )}
      title={task.name}
    >
      {task.name}
    </button>
  );
}

function DayCell({
  day,
  inMonth,
  tasks,
  onOpen,
  onCreate,
}: {
  day: Date;
  inMonth: boolean;
  tasks: Task[];
  onOpen: (id: string) => void;
  onCreate: (due: string) => void;
}) {
  const id = toDateOnly(day);
  const { setNodeRef, isOver } = useDroppable({ id });
  const isToday = isSameDay(day, new Date());
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-24 flex-col gap-0.5 border border-zinc-100 p-1 dark:border-zinc-800',
        !inMonth && 'bg-zinc-50/50 text-zinc-400 dark:bg-zinc-900/40',
        isOver && 'bg-indigo-50 dark:bg-indigo-950/40',
      )}
    >
      <button
        type="button"
        onClick={() => onCreate(id)}
        className="self-start"
        aria-label={`Vytvořit úkol na ${id}`}
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs',
            isToday && 'bg-indigo-600 text-white',
          )}
        >
          {format(day, 'd')}
        </span>
      </button>
      {tasks.map((t) => (
        <TaskPill key={t.id} task={t} onOpen={onOpen} />
      ))}
    </div>
  );
}

export default function CalendarView() {
  const { tasks } = useFilteredTasks();
  const update = useUpdateTask();
  const openTask = useTaskStore((s) => s.openTask);
  const openCreate = useTaskStore((s) => s.openCreate);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = toDateOnly(parseNotionDate(t.dueDate));
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const onDragEnd = (e: DragEndEvent): void => {
    const overId = e.over?.id;
    if (overId === undefined) return;
    const task = tasks.find((t) => t.id === e.active.id);
    const due = String(overId);
    if (task && task.dueDate !== due) update.mutate({ id: task.id, input: { dueDate: due } });
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="min-w-40 text-center text-sm font-semibold capitalize">
          {format(month, 'LLLL yyyy')}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Další měsíc"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-medium text-zinc-400">
            {w}
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              inMonth={isSameMonth(day, month)}
              tasks={byDay.get(toDateOnly(day)) ?? []}
              onOpen={openTask}
              onCreate={(due) => openCreate({ due })}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
