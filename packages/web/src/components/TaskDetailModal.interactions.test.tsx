import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/tasks', () => ({
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(async () => undefined),
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { TaskDetailModal } from './TaskDetailModal';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';
import * as tasksApi from '@/api/tasks';

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({ openTaskId: 'p1' });
});

describe('TaskDetailModal interakce', () => {
  it('zaškrtnutí podúkolu volá updateTask(Done)', async () => {
    const parent = makeTask({ id: 'p1', name: 'Rodič' });
    const child = makeTask({ id: 'c1', name: 'Dítě', parentId: 'p1', status: 'Todo' });
    renderWithProviders(<TaskDetailModal />, { tasks: [parent, child] });

    await userEvent.click(screen.getByLabelText('Hotovo: Dítě'));
    expect(tasksApi.updateTask).toHaveBeenCalledWith('c1', { status: 'Done' });
  });

  it('smazání zavře modal', async () => {
    renderWithProviders(<TaskDetailModal />, { tasks: [makeTask({ id: 'p1', name: 'Rodič' })] });
    await userEvent.click(screen.getByRole('button', { name: /Smazat/ }));
    expect(useTaskStore.getState().openTaskId).toBeNull();
  });

  it('změna názvu po blur volá updateTask', async () => {
    renderWithProviders(<TaskDetailModal />, { tasks: [makeTask({ id: 'p1', name: 'Staré' })] });
    const input = screen.getByDisplayValue('Staré');
    await userEvent.clear(input);
    await userEvent.type(input, 'Nové jméno');
    await userEvent.tab();
    expect(tasksApi.updateTask).toHaveBeenCalledWith('p1', { name: 'Nové jméno' });
  });
});
