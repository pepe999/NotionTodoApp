import { describe, it, expect, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';
import { renderWithProviders } from '@/test/utils';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

afterEach(() => setOnline(true));

describe('OfflineBanner', () => {
  it('je skrytý online', () => {
    setOnline(true);
    const { container } = renderWithProviders(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('zobrazí se offline', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
