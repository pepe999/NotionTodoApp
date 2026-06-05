import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './App';
import { ThemeProvider } from '@/lib/theme';
import { queryClient, AUTH_KEY } from '@/lib/queryClient';
import { setUnauthorizedHandler } from '@/lib/api';
import './index.css';

// Při 401 z libovolného API přepočítej auth → ProtectedRoute přesměruje na login.
setUnauthorizedHandler(() => {
  void queryClient.invalidateQueries({ queryKey: AUTH_KEY });
});

const root = document.getElementById('root');
if (!root) throw new Error('Chybí #root element.');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster richColors closeButton position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
