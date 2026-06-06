import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme';

function Consumer() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
    </div>
  );
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => localStorage.clear());
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('system + prefers dark → resolved dark a .dark na <html>', () => {
    window.matchMedia = (q: string): MediaQueryList =>
      ({
        matches: true,
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme persistuje volbu', () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    act(() => screen.getByRole('button', { name: 'dark' }).click());
    expect(localStorage.getItem('nta-theme')).toBe('dark');
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });
});
