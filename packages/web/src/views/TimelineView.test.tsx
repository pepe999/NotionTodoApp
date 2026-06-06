import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import TimelineView from './TimelineView';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => useTaskStore.setState({ filters: { search: '', tags: [], status: null } }));

describe('TimelineView', () => {
  it('vykreslí bar pro úkol s termínem', () => {
    renderWithProviders(<TimelineView />, {
      tasks: [makeTask({ name: 'S termínem', dueDate: '2026-06-10' })],
    });
    expect(screen.getByRole('button', { name: 'S termínem' })).toBeInTheDocument();
  });

  it('prázdný stav bez termínů', () => {
    renderWithProviders(<TimelineView />, { tasks: [makeTask({ dueDate: null })] });
    expect(screen.getByText(/Žádné úkoly s termínem/)).toBeInTheDocument();
  });
});
