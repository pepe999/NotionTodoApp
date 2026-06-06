import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(async () => {
    throw new Error('401');
  }),
  logout: vi.fn(),
  startGoogleLogin: vi.fn(),
}));

import { LoginPage } from './LoginPage';
import { renderWithProviders } from '@/test/utils';
import * as authApi from '@/api/auth';

describe('LoginPage', () => {
  it('zobrazí tlačítko a spustí Google login', async () => {
    renderWithProviders(<LoginPage />);
    const btn = await screen.findByRole('button', { name: 'Přihlásit přes Google' });
    await userEvent.click(btn);
    expect(authApi.startGoogleLogin).toHaveBeenCalledOnce();
  });
});
