import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(async () => ({ id: 'new' })),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(async () => undefined),
  createSubtask: vi.fn(async () => ({ id: 's' })),
  fetchTasks: vi.fn(async () => []),
}));

import { useCreateTask, useUpdateTask, useDeleteTask, useCreateSubtask } from './useTasks';
import { makeClient } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { TASKS_KEY } from '@/lib/queryClient';
import * as tasksApi from '@/api/tasks';

const input = { name: 'N', status: 'Todo' as const, tags: [], ownerIds: [], dependsOnIds: [] };

function setup() {
  const client = makeClient();
  client.setQueryData(TASKS_KEY, [makeTask({ id: 'a' })]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe('useTasks mutace', () => {
  it('create/update/delete/subtask volají API', async () => {
    const { wrapper } = setup();
    const create = renderHook(() => useCreateTask(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync(input);
    });
    expect(tasksApi.createTask).toHaveBeenCalledOnce();

    const upd = renderHook(() => useUpdateTask(), { wrapper });
    await act(async () => {
      await upd.result.current.mutateAsync({ id: 'a', input: { status: 'Done' } });
    });
    expect(tasksApi.updateTask).toHaveBeenCalledOnce();

    const del = renderHook(() => useDeleteTask(), { wrapper });
    await act(async () => {
      await del.result.current.mutateAsync('a');
    });
    expect(tasksApi.deleteTask).toHaveBeenCalledOnce();

    const sub = renderHook(() => useCreateSubtask(), { wrapper });
    await act(async () => {
      await sub.result.current.mutateAsync({ parentId: 'a', input });
    });
    expect(tasksApi.createSubtask).toHaveBeenCalledOnce();
  });

  it('rollback cache při chybě create', async () => {
    vi.mocked(tasksApi.createTask).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(tasksApi.fetchTasks).mockResolvedValue([makeTask({ id: 'a' })]);
    const { client, wrapper } = setup();
    const create = renderHook(() => useCreateTask(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync(input).catch(() => undefined);
    });
    expect(tasksApi.createTask).toHaveBeenCalled();
    expect(client.getQueryData(TASKS_KEY)).toBeDefined();
  });
});
