import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import { useTaskStore } from '@/store/taskStore';

beforeEach(() => useTaskStore.setState({ filters: { search: '', tags: [], status: null } }));

describe('SearchBar', () => {
  it('po debounce zapíše hledaný text do store', async () => {
    render(<SearchBar />);
    await userEvent.type(screen.getByLabelText('Hledat úkoly'), 'report');
    await waitFor(() => expect(useTaskStore.getState().filters.search).toBe('report'));
  });
});
