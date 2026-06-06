import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/tasks', () => {
  const t = (o: { id: string; status?: string; tags?: string[]; parentId?: string | null }) => ({
    id: o.id,
    name: `n-${o.id}`,
    status: o.status ?? 'Todo',
    tags: o.tags ?? [],
    dueDate: null,
    timeline: null,
    ownerIds: [],
    description: '',
    dependsOnIds: [],
    parentId: o.parentId ?? null,
    lastEditedTime: '',
    url: '',
  });
  return {
    fetchTasks: vi.fn(async () => [
      t({ id: 'p', tags: ['x'] }),
      t({ id: 'c', parentId: 'p' }),
      t({ id: 'o', status: 'Done' }),
    ]),
    createTask: vi.fn(),
    createSubtask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  };
});

import { useFilteredTasks, useSubtaskCounts } from './useTasks';
import { makeClient } from '@/test/utils';
import { useTaskStore } from '@/store/taskStore';

function wrap() {
  const client = makeClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useTasks', () => {
  it('načte vše, filtruje podle statusu a počítá podúkoly', async () => {
    useTaskStore.setState({ filters: { search: '', tags: [], status: null } });
    const wrapper = wrap();

    const filtered = renderHook(() => useFilteredTasks(), { wrapper });
    const counts = renderHook(() => useSubtaskCounts(), { wrapper: wrap() });

    await waitFor(() => expect(filtered.result.current.all.length).toBe(3));

    act(() => useTaskStore.getState().setStatus('Done'));
    await waitFor(() => expect(filtered.result.current.tasks.length).toBe(1));

    await waitFor(() => expect(counts.result.current.get('p')).toBe(1));
  });
});
