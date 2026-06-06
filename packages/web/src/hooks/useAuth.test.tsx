import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(async () => ({ id: 'u', email: 'a@b.cz', name: 'A', avatarUrl: null })),
  logout: vi.fn(async () => ({ ok: true })),
  startGoogleLogin: vi.fn(),
}));

import { useAuth } from './useAuth';
import { makeClient } from '@/test/utils';
import * as authApi from '@/api/auth';

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
});

describe('useAuth', () => {
  it('načte uživatele a logout zavolá API', async () => {
    const client = makeClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user?.email).toBe('a@b.cz'));

    await act(async () => {
      await result.current.logout();
    });
    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(window.location.href).toBe('/login');
  });
});
