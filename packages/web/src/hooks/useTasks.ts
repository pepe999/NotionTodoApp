import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task, CreateTaskInput, UpdateTaskInput } from '@notiontodoapp/shared';
import { fetchTasks, createTask, updateTask, deleteTask, createSubtask } from '@/api/tasks';
import { TASKS_KEY } from '@/lib/queryClient';
import { useTaskStore } from '@/store/taskStore';

/**
 * Jeden zdroj pravdy (PLAN.md 3.4): kompletní flat list. Polling 30 s, ale
 * pauza když je tab skrytý a žádný background refetch → šetří volání Notion.
 */
export function useTasksQuery() {
  return useQuery<Task[]>({
    queryKey: TASKS_KEY,
    queryFn: ({ signal }) => fetchTasks(signal),
    refetchInterval: () => (document.hidden ? false : 30_000),
    refetchIntervalInBackground: false,
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });
}

/** Filtrace probíhá client-side nad jediným cache zdrojem (search + tagy AND + status). */
export function useFilteredTasks(): { tasks: Task[]; all: Task[]; isLoading: boolean } {
  const { data, isLoading } = useTasksQuery();
  const filters = useTaskStore((s) => s.filters);
  const all = useMemo(() => data ?? [], [data]);

  const tasks = useMemo(() => {
    let list = all;
    if (filters.status) list = list.filter((t) => t.status === filters.status);
    if (filters.tags.length > 0)
      list = list.filter((t) => filters.tags.every((tag) => t.tags.includes(tag)));
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, filters]);

  return { tasks, all, isLoading };
}

/** Počty podúkolů podle parentId (z jednoho seznamu → žádný N+1). */
export function useSubtaskCounts(): Map<string, number> {
  const { data } = useTasksQuery();
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const t of data ?? []) {
      if (t.parentId) map.set(t.parentId, (map.get(t.parentId) ?? 0) + 1);
    }
    return map;
  }, [data]);
}

export function useTask(id: string | null): Task | undefined {
  const { data } = useTasksQuery();
  return useMemo(() => (id ? data?.find((t) => t.id === id) : undefined), [data, id]);
}

export function useAllTags(): string[] {
  const { data } = useTasksQuery();
  return useMemo(() => {
    const set = new Set<string>();
    for (const t of data ?? []) for (const tag of t.tags) set.add(tag);
    return [...set].sort();
  }, [data]);
}

function tempTask(input: CreateTaskInput, parentId: string | null): Task {
  return {
    id: `temp-${crypto.randomUUID()}`,
    name: input.name,
    status: input.status ?? 'Todo',
    tags: input.tags ?? [],
    dueDate: input.dueDate ?? null,
    timeline: input.timeline ?? null,
    ownerIds: input.ownerIds ?? [],
    description: input.description ?? '',
    dependsOnIds: input.dependsOnIds ?? [],
    parentId,
    lastEditedTime: new Date().toISOString(),
    url: '',
  };
}

/** Optimistický create (temp ID, rollback při chybě, invalidace v onSettled). */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
      qc.setQueryData<Task[]>(TASKS_KEY, [...prev, tempTask(input, input.parentId ?? null)]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(TASKS_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, input }: { parentId: string; input: CreateTaskInput }) =>
      createSubtask(parentId, input),
    onMutate: async ({ parentId, input }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
      qc.setQueryData<Task[]>(TASKS_KEY, [...prev, tempTask(input, parentId)]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(TASKS_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => updateTask(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
      qc.setQueryData<Task[]>(
        TASKS_KEY,
        prev.map((t) => (t.id === id ? ({ ...t, ...input } as Task) : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(TASKS_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
      qc.setQueryData<Task[]>(
        TASKS_KEY,
        prev.filter((t) => t.id !== id && t.parentId !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(TASKS_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
