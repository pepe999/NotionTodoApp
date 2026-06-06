import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  startGoogleLogin: vi.fn(),
}));

import { ProtectedRoute } from './ProtectedRoute';
import { renderWithProviders } from '@/test/utils';
import * as authApi from '@/api/auth';

const tree = (
  <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <div>Tajný obsah</div>
        </ProtectedRoute>
      }
    />
    <Route path="/login" element={<div>Login stránka</div>} />
  </Routes>
);

beforeEach(() => vi.clearAllMocks());

describe('ProtectedRoute', () => {
  it('pustí přihlášeného uživatele', async () => {
    vi.mocked(authApi.fetchMe).mockResolvedValueOnce({
      id: 'u',
      email: 'a@b.cz',
      name: 'A',
      avatarUrl: null,
    });
    renderWithProviders(tree);
    expect(await screen.findByText('Tajný obsah')).toBeInTheDocument();
  });

  it('přesměruje nepřihlášeného na /login', async () => {
    vi.mocked(authApi.fetchMe).mockRejectedValueOnce(new Error('401'));
    renderWithProviders(tree);
    expect(await screen.findByText('Login stránka')).toBeInTheDocument();
  });
});
