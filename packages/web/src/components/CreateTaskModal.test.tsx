import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(async () => ({ id: 'new' })),
  createSubtask: vi.fn(async () => ({ id: 'sub' })),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(async () => undefined),
  fetchTasks: vi.fn(async () => []),
}));

import { CreateTaskModal } from './CreateTaskModal';
import { renderWithProviders } from '@/test/utils';
import { useTaskStore } from '@/store/taskStore';
import * as tasksApi from '@/api/tasks';

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({ createOpen: true, createParentId: null, createDefaultDue: null });
});

describe('CreateTaskModal', () => {
  it('odešle nový úkol přes API', async () => {
    renderWithProviders(<CreateTaskModal />);
    await userEvent.type(screen.getByLabelText('Název'), 'Nový úkol');
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit' }));
    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledOnce());
  });

  it('nevytvoří úkol bez názvu (tlačítko disabled)', () => {
    renderWithProviders(<CreateTaskModal />);
    expect(screen.getByRole('button', { name: 'Vytvořit' })).toBeDisabled();
  });
});
