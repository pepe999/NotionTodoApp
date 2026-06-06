import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import { TaskDetailModal } from './TaskDetailModal';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

describe('TaskDetailModal', () => {
  beforeEach(() => useTaskStore.setState({ openTaskId: null }));

  it('nic nevykreslí bez otevřeného úkolu', () => {
    const { container } = renderWithProviders(<TaskDetailModal />, { tasks: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it('zobrazí detail s názvem a počtem podúkolů', () => {
    const parent = makeTask({ id: 'p1', name: 'Rodič' });
    const child = makeTask({ id: 'c1', name: 'Dítě', parentId: 'p1' });
    useTaskStore.setState({ openTaskId: 'p1' });
    renderWithProviders(<TaskDetailModal />, { tasks: [parent, child] });
    expect(screen.getByDisplayValue('Rodič')).toBeInTheDocument();
    expect(screen.getByText('Podúkoly (1)')).toBeInTheDocument();
    expect(screen.getByText('Dítě')).toBeInTheDocument();
  });
});
