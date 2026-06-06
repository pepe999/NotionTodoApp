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

import CalendarView from './CalendarView';
import { renderWithProviders } from '@/test/utils';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() =>
  useTaskStore.setState({
    filters: { search: '', tags: [], status: null },
    createOpen: false,
    createDefaultDue: null,
  }),
);

describe('CalendarView interakce', () => {
  it('navigace na další měsíc a klik na den otevře create s datem', async () => {
    renderWithProviders(<CalendarView />, { tasks: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Další měsíc' }));

    const dayButtons = screen.getAllByRole('button', { name: /Vytvořit úkol na/ });
    expect(dayButtons.length).toBeGreaterThan(0);
    await userEvent.click(dayButtons[0]!);
    expect(useTaskStore.getState().createOpen).toBe(true);
    expect(useTaskStore.getState().createDefaultDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
