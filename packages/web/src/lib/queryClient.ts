import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 25_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export const TASKS_KEY = ['tasks'] as const;
export const AUTH_KEY = ['auth', 'me'] as const;
