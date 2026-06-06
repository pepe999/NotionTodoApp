import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('Prasklo to');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('zobrazí fallback při chybě potomka', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Něco se pokazilo')).toBeInTheDocument();
    expect(screen.getByText('Prasklo to')).toBeInTheDocument();
  });

  it('vykreslí potomka bez chyby', () => {
    render(
      <ErrorBoundary>
        <p>OK obsah</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('OK obsah')).toBeInTheDocument();
  });
});
