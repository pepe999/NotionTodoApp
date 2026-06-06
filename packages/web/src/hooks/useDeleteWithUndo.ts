import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task } from '@notiontodoapp/shared';
import { deleteTask } from '@/api/tasks';
import { TASKS_KEY } from '@/lib/queryClient';

/**
 * Mazání s „Vrátit zpět" (PLAN.md 3.11): optimistické odstranění, skutečné
 * smazání se zavolá až po 5 s. Undo do té doby jen obnoví cache (žádné volání API).
 */
export function useDeleteWithUndo(): (task: Task) => void {
  const qc = useQueryClient();

  return (task: Task) => {
    const prev = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
    qc.setQueryData<Task[]>(
      TASKS_KEY,
      prev.filter((t) => t.id !== task.id && t.parentId !== task.id),
    );

    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      void deleteTask(task.id)
        .then(() => qc.invalidateQueries({ queryKey: TASKS_KEY }))
        .catch(() => {
          qc.setQueryData(TASKS_KEY, prev);
          toast.error('Smazání selhalo.');
        });
    }, 5000);

    toast(`Úkol „${task.name}" smazán`, {
      action: {
        label: 'Vrátit zpět',
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData(TASKS_KEY, prev);
        },
      },
    });
  };
}
