import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type Announcements,
} from '@dnd-kit/core';
import type { Task, TaskStatus } from '@notiontodoapp/shared';
import { STATUS_ORDER, statusMeta } from '@/lib/status';
import { useFilteredTasks, useSubtaskCounts, useUpdateTask } from '@/hooks/useTasks';
import { useTaskStore } from '@/store/taskStore';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

const announcements: Announcements = {
  onDragStart: ({ active }) => `Začalo přetahování úkolu ${String(active.id)}.`,
  onDragOver: ({ over }) => (over ? `Nad sloupcem ${String(over.id)}.` : 'Mimo sloupce.'),
  onDragEnd: ({ over }) => (over ? `Úkol přesunut do ${String(over.id)}.` : 'Přesun zrušen.'),
  onDragCancel: () => 'Přesun zrušen.',
};

function DraggableCard({
  task,
  count,
  onOpen,
}: {
  task: Task;
  count: number;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <TaskCard task={task} subtaskCount={count} onOpen={onOpen} />
    </div>
  );
}

function Column({
  status,
  tasks,
  counts,
  onOpen,
  onCreate,
}: {
  status: TaskStatus;
  tasks: Task[];
  counts: Map<string, number>;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = statusMeta[status];
  return (
    <section className="flex w-72 shrink-0 flex-col" aria-label={`Sloupec ${meta.label}`}>
      <header className="mb-2 flex items-center gap-2 px-1">
        <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <span className="rounded-full bg-zinc-100 px-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={onCreate}
          aria-label={`Přidat úkol do ${meta.label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-colors',
          isOver && 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30',
        )}
      >
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} count={counts.get(t.id) ?? 0} onOpen={onOpen} />
        ))}
        {tasks.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-400">Prázdné</p>
        )}
      </div>
    </section>
  );
}

export function KanbanView() {
  const { tasks } = useFilteredTasks();
  const counts = useSubtaskCounts();
  const update = useUpdateTask();
  const openTask = useTaskStore((s) => s.openTask);
  const openCreate = useTaskStore((s) => s.openCreate);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const topLevel = tasks.filter((t) => !t.parentId);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const onDragEnd = (e: DragEndEvent): void => {
    setActiveId(null);
    const overId = e.over?.id;
    if (overId === undefined) return;
    const status = overId as TaskStatus;
    if (!STATUS_ORDER.includes(status)) return;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && task.status !== status) {
      update.mutate({ id: task.id, input: { status } });
    }
  };

  if (topLevel.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-zinc-500">Zatím žádné úkoly</p>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" /> Vytvořit první úkol
        </Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto p-4">
        {STATUS_ORDER.map((s) => (
          <Column
            key={s}
            status={s}
            tasks={topLevel.filter((t) => t.status === s)}
            counts={counts}
            onOpen={openTask}
            onCreate={() => openCreate()}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
