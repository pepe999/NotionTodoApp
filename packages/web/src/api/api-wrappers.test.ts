import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => ({})),
}));

import * as api from '@/lib/api';
import { fetchTasks, createTask, updateTask, deleteTask, createSubtask } from './tasks';
import { validateNotion, saveNotion } from './setup';
import { fetchMe, logout } from './auth';

const mocked = vi.mocked(api.apiFetch);

beforeEach(() => mocked.mockClear());

describe('api wrappers', () => {
  it('tasks endpointy volají správné cesty/metody', async () => {
    await fetchTasks();
    expect(mocked).toHaveBeenLastCalledWith('/api/tasks', {});

    await createTask({ name: 'x', status: 'Todo', tags: [], ownerIds: [], dependsOnIds: [] });
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    );

    await updateTask('id1', { status: 'Done' });
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/tasks/id1',
      expect.objectContaining({ method: 'PATCH' }),
    );

    await deleteTask('id1');
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/tasks/id1',
      expect.objectContaining({ method: 'DELETE' }),
    );

    await createSubtask('p1', {
      name: 'x',
      status: 'Todo',
      tags: [],
      ownerIds: [],
      dependsOnIds: [],
    });
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/tasks/p1/subtasks',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('setup endpointy', async () => {
    await validateNotion('tok', 'db');
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/setup/validate',
      expect.objectContaining({ method: 'POST' }),
    );
    await saveNotion('tok', 'db');
    expect(mocked).toHaveBeenLastCalledWith(
      '/api/setup/save',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('auth endpointy', async () => {
    await fetchMe();
    expect(mocked).toHaveBeenLastCalledWith('/auth/me');
    await logout();
    expect(mocked).toHaveBeenLastCalledWith('/auth/logout', { method: 'POST' });
  });
});
