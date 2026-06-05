import { apiFetch } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export const fetchMe = (): Promise<AuthUser> => apiFetch<AuthUser>('/auth/me');

export const logout = (): Promise<{ ok: boolean }> =>
  apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });

/** Přesměruje prohlížeč na backend OAuth start. */
export const startGoogleLogin = (): void => {
  window.location.href = '/auth/google';
};
