import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { renderWithProviders } from '@/test/utils';

beforeEach(() => localStorage.clear());

describe('ThemeToggle', () => {
  it('cykluje motiv light → dark → system', async () => {
    renderWithProviders(<ThemeToggle />);
    const btn = screen.getByRole('button');
    // výchozí system → klik na light
    await userEvent.click(btn);
    expect(localStorage.getItem('nta-theme')).toBe('light');
    await userEvent.click(btn);
    expect(localStorage.getItem('nta-theme')).toBe('dark');
    await userEvent.click(btn);
    expect(localStorage.getItem('nta-theme')).toBe('system');
  });
});
