import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  updateTask: vi.fn(async () => ({ id: 'u' })),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(async () => []),
}));

import { updateTask } from '@/api/tasks';
import { TodoListView } from './TodoListView';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({ filters: { search: '', tags: [], status: null }, todoHideDone: false });
});

describe('TodoListView', () => {
  it('řadí podle termínu, úkoly bez termínu na konec', () => {
    renderWithProviders(<TodoListView />, {
      tasks: [
        makeTask({ name: 'Bez termínu', status: 'Todo' }),
        makeTask({ name: 'Později', status: 'Todo', dueDate: '2026-07-01' }),
        makeTask({ name: 'Dříve', status: 'Todo', dueDate: '2026-06-01' }),
      ],
    });
    const list = screen.getByRole('list', { name: 'Seznam úkolů' });
    const names = within(list)
      .getAllByRole('checkbox')
      .map((cb) => cb.getAttribute('aria-label'));
    expect(names[0]).toContain('Dříve');
    expect(names[1]).toContain('Později');
    expect(names[2]).toContain('Bez termínu');
  });

  it('hotový úkol má zaškrtnutý checkbox a je v sekci Dokončené', () => {
    renderWithProviders(<TodoListView />, {
      tasks: [
        makeTask({ name: 'Aktivní', status: 'Todo' }),
        makeTask({ name: 'Hotový', status: 'Done' }),
      ],
    });
    const doneSection = screen.getByRole('region', { name: 'Dokončené úkoly' });
    const cb = within(doneSection).getByRole('checkbox');
    expect(cb).toBeChecked();
  });

  it('zaškrtnutí checkboxu změní status na Done (a zpět na Todo)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TodoListView />, {
      tasks: [makeTask({ id: 't1', name: 'Úkol A', status: 'Todo' })],
    });
    await user.click(screen.getByRole('checkbox', { name: /Úkol A.*hotový/ }));
    expect(updateTask).toHaveBeenCalledWith('t1', { status: 'Done' });
  });

  it('„Skrýt hotové" schová dokončené úkoly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TodoListView />, {
      tasks: [
        makeTask({ name: 'Aktivní', status: 'Todo' }),
        makeTask({ name: 'Hotový', status: 'Done' }),
      ],
    });
    expect(screen.getByText('Hotový')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Skrýt hotové' }));
    expect(screen.queryByText('Hotový')).not.toBeInTheDocument();
    expect(screen.getByText('Aktivní')).toBeInTheDocument();
  });

  it('hotový rodič s nedokončeným podúkolem se při skrytí hotových neskryje', () => {
    useTaskStore.setState({ todoHideDone: true });
    renderWithProviders(<TodoListView />, {
      tasks: [
        makeTask({ id: 'p1', name: 'Rodič hotový', status: 'Done' }),
        makeTask({ name: 'Podúkol nehotový', status: 'Todo', parentId: 'p1' }),
      ],
    });
    expect(screen.getByText('Rodič hotový')).toBeInTheDocument();
    expect(screen.getByText('Podúkol nehotový')).toBeInTheDocument();
  });

  it('podúkoly se zobrazí pod rodičem', () => {
    renderWithProviders(<TodoListView />, {
      tasks: [
        makeTask({ id: 'p1', name: 'Rodič', status: 'Todo' }),
        makeTask({ name: 'Dítě', status: 'Todo', parentId: 'p1' }),
      ],
    });
    expect(screen.getByText('Rodič')).toBeInTheDocument();
    expect(screen.getByText('Dítě')).toBeInTheDocument();
  });

  it('prázdný stav nabídne vytvoření prvního úkolu', () => {
    renderWithProviders(<TodoListView />, { tasks: [] });
    expect(screen.getByRole('button', { name: /Vytvořit první úkol/ })).toBeInTheDocument();
  });
});
