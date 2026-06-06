import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/tasks', () => {
  const t = (id: string, name: string, tags: string[], description = '') => ({
    id,
    name,
    status: 'Todo',
    tags,
    dueDate: null,
    timeline: null,
    ownerIds: [],
    description,
    dependsOnIds: [],
    parentId: null,
    lastEditedTime: '',
    url: '',
  });
  return {
    fetchTasks: vi.fn(async () => [
      t('a', 'Alpha', ['work']),
      t('b', 'Beta', ['home'], 'nějaký popis'),
    ]),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    createSubtask: vi.fn(),
  };
});

import { useFilteredTasks, useAllTags } from './useTasks';
import { makeClient } from '@/test/utils';
import { useTaskStore } from '@/store/taskStore';

function wrap() {
  const client = makeClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useTasks filtry', () => {
  it('filtruje podle tagů a fulltextu, useAllTags vrací unikáty', async () => {
    useTaskStore.setState({ filters: { search: '', tags: [], status: null } });
    const filtered = renderHook(() => useFilteredTasks(), { wrapper: wrap() });
    const tags = renderHook(() => useAllTags(), { wrapper: wrap() });

    await waitFor(() => expect(filtered.result.current.all.length).toBe(2));
    await waitFor(() => expect(tags.result.current).toEqual(['home', 'work']));

    act(() => useTaskStore.getState().toggleTag('work'));
    await waitFor(() => expect(filtered.result.current.tasks.map((t) => t.id)).toEqual(['a']));

    act(() => {
      useTaskStore.getState().resetFilters();
      useTaskStore.getState().setSearch('popis');
    });
    await waitFor(() => expect(filtered.result.current.tasks.map((t) => t.id)).toEqual(['b']));
  });
});
