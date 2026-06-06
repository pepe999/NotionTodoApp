import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagFilter } from './TagFilter';
import { renderWithProviders } from '@/test/utils';
import { makeTask } from '@/test/factory';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => useTaskStore.setState({ filters: { search: '', tags: [], status: null } }));

describe('TagFilter', () => {
  it('vykreslí unikátní tagy a toggle zapíše do store', async () => {
    renderWithProviders(<TagFilter />, {
      tasks: [makeTask({ tags: ['work'] }), makeTask({ tags: ['home', 'work'] })],
    });
    const workBtn = await screen.findByRole('button', { name: 'work' });
    expect(screen.getByRole('button', { name: 'home' })).toBeInTheDocument();

    await userEvent.click(workBtn);
    await waitFor(() => expect(useTaskStore.getState().filters.tags).toContain('work'));

    await userEvent.click(screen.getByRole('button', { name: 'Reset filtrů' }));
    await waitFor(() => expect(useTaskStore.getState().filters.tags).toHaveLength(0));
  });
});
