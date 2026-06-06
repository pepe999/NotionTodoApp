import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import { KanbanView } from './KanbanView';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => useTaskStore.setState({ filters: { search: '', tags: [], status: null } }));

describe('KanbanView', () => {
  it('vykreslí 4 sloupce a kartu úkolu', () => {
    renderWithProviders(<KanbanView />, {
      tasks: [
        makeTask({ name: 'Alpha', status: 'Todo' }),
        makeTask({ name: 'Beta', status: 'Done' }),
      ],
    });
    for (const col of ['Todo', 'In Progress', 'Review', 'Done']) {
      expect(screen.getByRole('heading', { name: col })).toBeInTheDocument();
    }
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('prázdný stav nabídne vytvoření prvního úkolu', () => {
    renderWithProviders(<KanbanView />, { tasks: [] });
    expect(screen.getByRole('button', { name: /Vytvořit první úkol/ })).toBeInTheDocument();
  });
});
