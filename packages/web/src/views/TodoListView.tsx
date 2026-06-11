import { useMemo } from 'react';
import type { Task } from '@notiontodoapp/shared';
import { useFilteredTasks, useUpdateTask } from '@/hooks/useTasks';
import { useTaskStore } from '@/store/taskStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate, isOverdue } from '@/lib/datetime';
import { t } from '@/lib/i18n';
import { CalendarDays, Plus } from 'lucide-react';

/** Řazení podle termínu: nejdřív úkoly s due date (vzestupně), bez termínu na konec. */
function byDueDate(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name, 'cs');
  }
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.name.localeCompare(b.name, 'cs');
}

function TodoRow({
  task,
  depth,
  onToggle,
  onOpen,
}: {
  task: Task;
  depth: number;
  onToggle: (task: Task, done: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const done = task.status === 'Done';
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <li
      className={cn(
        'flex items-center gap-3 border-b border-zinc-100 py-2.5 dark:border-zinc-800',
        depth > 0 && 'ml-7',
      )}
    >
      <input
        type="checkbox"
        className="h-[18px] w-[18px] shrink-0 rounded-full accent-indigo-600"
        checked={done}
        onChange={(e) => onToggle(task, e.target.checked)}
        aria-label={`Označit „${task.name}" jako ${done ? 'nedokončený' : 'hotový'}`}
      />
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Otevřít detail úkolu ${task.name}`}
      >
        <span
          className={cn(
            'truncate text-sm text-zinc-900 dark:text-zinc-100',
            done && 'text-zinc-400 line-through dark:text-zinc-500',
          )}
        >
          {task.name}
        </span>
        {task.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="hidden shrink-0 sm:inline-flex">
            {tag}
          </Badge>
        ))}
        {task.dueDate && (
          <span
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400',
              overdue && 'font-medium text-red-600 dark:text-red-400',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * Todo list pohled – klasický seznam ve stylu iOS Připomínek: checkbox = status
 * Done/Todo, řazení podle termínu, volba „Skrýt hotové". Podúkoly odsazené pod
 * rodičem; hotový rodič s nedokončenými podúkoly se při skrytí hotových
 * neskrývá (nedokončená práce nesmí zmizet).
 */
export function TodoListView() {
  const { tasks } = useFilteredTasks();
  const update = useUpdateTask();
  const openTask = useTaskStore((s) => s.openTask);
  const openCreate = useTaskStore((s) => s.openCreate);
  const hideDone = useTaskStore((s) => s.todoHideDone);
  const setHideDone = useTaskStore((s) => s.setTodoHideDone);

  const { roots, childrenOf, remaining } = useMemo(() => {
    const ids = new Set(tasks.map((tk) => tk.id));
    const children = new Map<string, Task[]>();
    for (const tk of tasks) {
      if (tk.parentId && ids.has(tk.parentId)) {
        const list = children.get(tk.parentId) ?? [];
        list.push(tk);
        children.set(tk.parentId, list);
      }
    }
    for (const list of children.values()) list.sort(byDueDate);
    // Root = top-level úkol; podúkol s odfiltrovaným rodičem se zobrazí jako root.
    const rootList = tasks.filter((tk) => !tk.parentId || !ids.has(tk.parentId)).sort(byDueDate);
    return {
      roots: rootList,
      childrenOf: (id: string) => children.get(id) ?? [],
      remaining: tasks.filter((tk) => tk.status !== 'Done').length,
    };
  }, [tasks]);

  const toggle = (task: Task, done: boolean): void => {
    update.mutate({ id: task.id, input: { status: done ? 'Done' : 'Todo' } });
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-zinc-500">{t('task.empty')}</p>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" /> {t('task.createFirst')}
        </Button>
      </div>
    );
  }

  const isRowDone = (tk: Task): boolean => tk.status === 'Done';
  const rootHidden = (tk: Task): boolean =>
    hideDone && isRowDone(tk) && childrenOf(tk.id).every(isRowDone);

  const activeRoots = roots.filter((tk) => !isRowDone(tk));
  const doneRoots = roots.filter(isRowDone).filter((tk) => !rootHidden(tk));

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {remaining === 0 ? 'Vše hotovo 🎉' : `Zbývá: ${remaining}`}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          Skrýt hotové
        </label>
      </div>

      <ul aria-label="Seznam úkolů">
        {activeRoots.map((task) => (
          <li key={task.id} className="list-none">
            <ul>
              <TodoRow task={task} depth={0} onToggle={toggle} onOpen={openTask} />
              {childrenOf(task.id)
                .filter((c) => !(hideDone && isRowDone(c)))
                .map((c) => (
                  <TodoRow key={c.id} task={c} depth={1} onToggle={toggle} onOpen={openTask} />
                ))}
            </ul>
          </li>
        ))}
      </ul>

      {doneRoots.length > 0 && (
        <section aria-label="Dokončené úkoly" className="mt-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Dokončené
          </h2>
          <ul>
            {doneRoots.map((task) => (
              <li key={task.id} className="list-none">
                <ul>
                  <TodoRow task={task} depth={0} onToggle={toggle} onOpen={openTask} />
                  {childrenOf(task.id)
                    .filter((c) => !(hideDone && isRowDone(c)))
                    .map((c) => (
                      <TodoRow key={c.id} task={c} depth={1} onToggle={toggle} onOpen={openTask} />
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default TodoListView;
