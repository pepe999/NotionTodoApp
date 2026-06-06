import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(async () => ({ id: 'u', email: 'a@b.cz', name: 'A', avatarUrl: null })),
  logout: vi.fn(),
  startGoogleLogin: vi.fn(),
}));
vi.mock('@/api/tasks', () => ({
  fetchTasks: vi.fn(async () => []),
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';

describe('DashboardPage', () => {
  it('vykreslí layout a přepne pohled na kalendář (lazy)', async () => {
    renderWithProviders(<DashboardPage />, {
      tasks: [makeTask({ name: 'Úkol', dueDate: '2026-06-10' })],
    });

    expect(screen.getByText('NotionTodoApp')).toBeInTheDocument();
    // výchozí Kanban
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Kalendář' }));
    expect(await screen.findByText('Po')).toBeInTheDocument(); // CalendarView se lazy načetl
  });
});
