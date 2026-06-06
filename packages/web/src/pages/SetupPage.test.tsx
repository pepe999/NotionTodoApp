import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/setup', () => ({
  validateNotion: vi.fn(async () => ({
    valid: true,
    columns: [
      { column: 'Name', expectedType: 'title', ok: true, actualType: 'title', message: null },
    ],
  })),
  saveNotion: vi.fn(async () => ({ ok: true, databaseId: 'd', validatedAt: 1 })),
}));

import { SetupPage } from './SetupPage';
import { renderWithProviders } from '@/test/utils';
import * as setupApi from '@/api/setup';

beforeEach(() => vi.clearAllMocks());

describe('SetupPage', () => {
  it('projde wizardem: intro → credentials → validace → uložení', async () => {
    renderWithProviders(<SetupPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    await userEvent.type(screen.getByLabelText('Integration token'), 'secret_abc');
    await userEvent.type(screen.getByLabelText('Database ID nebo URL'), 'db-123');
    await userEvent.click(screen.getByRole('button', { name: 'Ověřit' }));

    await waitFor(() => expect(setupApi.validateNotion).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Databáze je v pořádku/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Uložit a pokračovat/ }));
    await waitFor(() => expect(setupApi.saveNotion).toHaveBeenCalledOnce());
  });
});
