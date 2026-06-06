import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, logout as apiLogout, type AuthUser } from '@/api/auth';
import type { ApiError } from '@/lib/api';
import { AUTH_KEY } from '@/lib/queryClient';

export interface UseAuth {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuth {
  const qc = useQueryClient();
  const query = useQuery<AuthUser, ApiError>({
    queryKey: AUTH_KEY,
    queryFn: () => fetchMe(),
    retry: false,
    staleTime: 60_000,
  });

  const logout = async (): Promise<void> => {
    await apiLogout().catch(() => undefined);
    qc.removeQueries({ queryKey: AUTH_KEY });
    qc.clear();
    window.location.href = '/login';
  };

  return { user: query.data ?? null, isLoading: query.isLoading, logout };
}
