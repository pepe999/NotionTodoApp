import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CreateTaskInput, TaskStatus } from '@notiontodoapp/shared';
import { useTaskStore } from '@/store/taskStore';
import { useCreateTask, useCreateSubtask } from '@/hooks/useTasks';
import { STATUS_ORDER } from '@/lib/status';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateTaskModal() {
  const open = useTaskStore((s) => s.createOpen);
  const parentId = useTaskStore((s) => s.createParentId);
  const defaultDue = useTaskStore((s) => s.createDefaultDue);
  const close = useTaskStore((s) => s.closeCreate);

  const createTask = useCreateTask();
  const createSubtask = useCreateSubtask();
  const pending = createTask.isPending || createSubtask.isPending;

  const [name, setName] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [due, setDue] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setStatus('Todo');
      setDue(defaultDue ?? '');
      setTags('');
      setDescription('');
    }
  }, [open, defaultDue]);

  const submit = (): void => {
    if (!name.trim() || pending) return;
    const input: CreateTaskInput = {
      name: name.trim(),
      status,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      ownerIds: [],
      dependsOnIds: [],
      ...(due ? { dueDate: due } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    const onDone = {
      onSuccess: () => {
        toast.success('Úkol vytvořen');
        close();
      },
      onError: () => toast.error('Vytvoření úkolu selhalo'),
    };

    if (parentId) createSubtask.mutate({ parentId, input }, onDone);
    else createTask.mutate(input, onDone);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentId ? 'Nový podúkol' : 'Nový úkol'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-name">Název</Label>
            <Input
              id="ct-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
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
              <Label htmlFor="ct-due">Termín</Label>
              <Input id="ct-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-tags">Tagy (oddělené čárkou)</Label>
            <Input id="ct-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-desc">Popis</Label>
            <Textarea
              id="ct-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Zrušit
            </Button>
            <Button onClick={submit} disabled={!name.trim() || pending}>
              Vytvořit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
