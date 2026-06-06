import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/tasks', () => ({
  deleteTask: vi.fn(async () => undefined),
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(),
  fetchTasks: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: vi.fn() }));

import { useDeleteWithUndo } from './useDeleteWithUndo';
import { makeClient } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { TASKS_KEY } from '@/lib/queryClient';
import * as tasksApi from '@/api/tasks';
import type { Task } from '@notiontodoapp/shared';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('useDeleteWithUndo', () => {
  it('optimisticky odstraní úkol a po 5 s zavolá delete', async () => {
    vi.useFakeTimers();
    const client = makeClient();
    const task = makeTask({ id: 'd1' });
    client.setQueryData<Task[]>(TASKS_KEY, [task, makeTask({ id: 'keep' })]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteWithUndo(), { wrapper });

    act(() => result.current(task));
    // Optimisticky pryč z cache
    expect(client.getQueryData<Task[]>(TASKS_KEY)?.some((t) => t.id === 'd1')).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(tasksApi.deleteTask).toHaveBeenCalledWith('d1');
  });
});
