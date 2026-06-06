import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(async () => ({ id: 'new' })),
  createSubtask: vi.fn(async () => ({ id: 'sub' })),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import { CreateTaskModal } from './CreateTaskModal';
import { renderWithProviders } from '@/test/utils';
import { useTaskStore } from '@/store/taskStore';
import * as tasksApi from '@/api/tasks';

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    createOpen: true,
    createParentId: 'parent-1',
    createDefaultDue: '2026-06-10',
  });
});

describe('CreateTaskModal – podúkol', () => {
  it('s parentId vytvoří podúkol s tagy a popisem', async () => {
    renderWithProviders(<CreateTaskModal />);
    expect(screen.getByText('Nový podúkol')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Název'), 'Podúkol');
    await userEvent.type(screen.getByLabelText('Tagy (oddělené čárkou)'), 'a, b');
    await userEvent.type(screen.getByLabelText('Popis'), 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit' }));

    await waitFor(() => expect(tasksApi.createSubtask).toHaveBeenCalledOnce());
    const [parentId, input] = vi.mocked(tasksApi.createSubtask).mock.calls[0]!;
    expect(parentId).toBe('parent-1');
    expect(input.tags).toEqual(['a', 'b']);
    expect(input.dueDate).toBe('2026-06-10');
  });
});
