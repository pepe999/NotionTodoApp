import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import CalendarView from './CalendarView';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => useTaskStore.setState({ filters: { search: '', tags: [], status: null } }));

describe('CalendarView', () => {
  it('vykreslí mřížku s názvy dnů', () => {
    renderWithProviders(<CalendarView />, { tasks: [makeTask({ dueDate: '2026-06-10' })] });
    expect(screen.getByText('Po')).toBeInTheDocument();
    expect(screen.getByText('Ne')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Další měsíc' })).toBeInTheDocument();
  });
});
