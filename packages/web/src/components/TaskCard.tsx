import { memo } from 'react';
import type { Task } from '@notiontodoapp/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate, isOverdue } from '@/lib/datetime';
import { CalendarDays, ListTree, User } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  subtaskCount?: number;
  onOpen?: (id: string) => void;
}

function TaskCardImpl({ task, subtaskCount = 0, onOpen }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(task.id)}
      className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label={`Úkol: ${task.name}`}
    >
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.name}</span>

      {task.tags.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </span>
      )}

      <span className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {task.dueDate && (
          <span
            className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-600')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListTree className="h-3.5 w-3.5" />
            {subtaskCount}
          </span>
        )}
        {task.ownerIds.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {task.ownerIds.length}
          </span>
        )}
      </span>
    </button>
  );
}

export const TaskCard = memo(TaskCardImpl);
