import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/tasks', () => ({
  updateTask: vi.fn(async () => ({ id: 'u' })),
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import { KanbanView } from './KanbanView';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() =>
  useTaskStore.setState({
    filters: { search: '', tags: [], status: null },
    createOpen: false,
    openTaskId: null,
  }),
);

describe('KanbanView interakce', () => {
  it('tlačítko + ve sloupci otevře create modal', async () => {
    renderWithProviders(<KanbanView />, { tasks: [makeTask({ status: 'Todo' })] });
    await userEvent.click(screen.getByRole('button', { name: 'Přidat úkol do Todo' }));
    expect(useTaskStore.getState().createOpen).toBe(true);
  });

  it('klik na kartu otevře detail', async () => {
    renderWithProviders(<KanbanView />, {
      tasks: [makeTask({ id: 'k1', name: 'Karta', status: 'Todo' })],
    });
    await userEvent.click(screen.getByText('Karta'));
    expect(useTaskStore.getState().openTaskId).toBe('k1');
  });
});
