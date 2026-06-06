import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(async () => {
    throw new Error('401');
  }),
  logout: vi.fn(),
  startGoogleLogin: vi.fn(),
}));

import { App } from './App';
import { renderWithProviders } from '@/test/utils';

describe('App routing', () => {
  it('na /login vykreslí přihlášení', async () => {
    renderWithProviders(<App />, { route: '/login' });
    expect(
      await screen.findByRole('button', { name: 'Přihlásit přes Google' }),
    ).toBeInTheDocument();
  });

  it('chráněnou cestu / přesměruje nepřihlášeného na login', async () => {
    renderWithProviders(<App />, { route: '/' });
    expect(
      await screen.findByRole('button', { name: 'Přihlásit přes Google' }),
    ).toBeInTheDocument();
  });
});
