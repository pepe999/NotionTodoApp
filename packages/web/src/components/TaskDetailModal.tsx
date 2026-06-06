import { useEffect, useState } from 'react';
import type { TaskStatus } from '@notiontodoapp/shared';
import { useTaskStore } from '@/store/taskStore';
import { useFilteredTasks, useTask, useUpdateTask } from '@/hooks/useTasks';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { STATUS_ORDER } from '@/lib/status';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, X, ChevronRight } from 'lucide-react';

export function TaskDetailModal() {
  const openTaskId = useTaskStore((s) => s.openTaskId);
  const close = useTaskStore((s) => s.closeTask);
  const openTask = useTaskStore((s) => s.openTask);
  const openCreate = useTaskStore((s) => s.openCreate);

  const task = useTask(openTaskId);
  const { all } = useFilteredTasks();
  const update = useUpdateTask();
  const deleteWithUndo = useDeleteWithUndo();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description);
      setTags(task.tags.join(', '));
    }
  }, [task?.id]);

  if (!task) return null;

  const save = (input: Parameters<typeof update.mutate>[0]['input']): void => {
    update.mutate({ id: task.id, input });
  };

  const children = all.filter((t) => t.parentId === task.id);
  const parent = task.parentId ? all.find((t) => t.id === task.parentId) : undefined;
  const dependencies = task.dependsOnIds
    .map((id) => all.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const candidates = all.filter(
    (t) => !t.parentId && t.id !== task.id && !task.dependsOnIds.includes(t.id),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {parent && (
            <button
              type="button"
              onClick={() => openTask(parent.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-600"
            >
              {parent.name} <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <DialogTitle className="sr-only">Detail úkolu</DialogTitle>
          <DialogDescription className="sr-only">Editace polí úkolu</DialogDescription>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== task.name && save({ name: name.trim() })}
            className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={task.status} onValueChange={(v) => save({ status: v as TaskStatus })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="td-due">Termín</Label>
            <Input
              id="td-due"
              type="date"
              value={task.dueDate ?? ''}
              onChange={(e) => save({ dueDate: e.target.value || null })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="td-tags">Tagy</Label>
          <Input
            id="td-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onBlur={() =>
              save({
                tags: tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="td-desc">Popis</Label>
          <Textarea
            id="td-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== task.description && save({ description })}
          />
        </div>

        {/* Závislosti */}
        <div className="flex flex-col gap-1.5">
          <Label>Závisí na</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {dependencies.map((d) => (
              <Badge key={d.id} variant="outline" className="gap-1">
                {d.name}
                <button
                  type="button"
                  aria-label={`Odebrat závislost ${d.name}`}
                  onClick={() =>
                    save({ dependsOnIds: task.dependsOnIds.filter((id) => id !== d.id) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {candidates.length > 0 && (
              <Select onValueChange={(v) => save({ dependsOnIds: [...task.dependsOnIds, v] })}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="+ přidat" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Podúkoly */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Podúkoly ({children.length})</Label>
            <Button variant="ghost" size="sm" onClick={() => openCreate({ parentId: task.id })}>
              <Plus className="h-4 w-4" /> Přidat
            </Button>
          </div>
          <ul className="flex flex-col gap-1">
            {children.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.status === 'Done'}
                  aria-label={`Hotovo: ${c.name}`}
                  onChange={(e) =>
                    update.mutate({
                      id: c.id,
                      input: { status: e.target.checked ? 'Done' : 'Todo' },
                    })
                  }
                />
                <button
                  type="button"
                  className={c.status === 'Done' ? 'text-zinc-400 line-through' : ''}
                  onClick={() => openTask(c.id)}
                >
                  {c.name}
                </button>
              </li>
            ))}
            {children.length === 0 && <li className="text-xs text-zinc-400">Žádné podúkoly</li>}
          </ul>
        </div>

        <div className="flex justify-between pt-2">
          <Button
            variant="destructive"
            onClick={() => {
              deleteWithUndo(task);
              close();
            }}
          >
            <Trash2 className="h-4 w-4" /> Smazat
          </Button>
          <Button variant="secondary" onClick={close}>
            Zavřít
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
