import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme';
import type { Task } from '@notiontodoapp/shared';
import { TASKS_KEY } from '@/lib/queryClient';

export function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface Options {
  client?: QueryClient;
  route?: string;
  /** Předvyplní cache úkolů (TASKS_KEY), aby useTasksQuery nesahal na síť. */
  tasks?: Task[];
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  const client = opts.client ?? makeClient();
  if (opts.tasks) client.setQueryData(TASKS_KEY, opts.tasks);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[opts.route ?? '/']}>{children}</MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return { client, ...render(ui, { wrapper: Wrapper }) };
}
