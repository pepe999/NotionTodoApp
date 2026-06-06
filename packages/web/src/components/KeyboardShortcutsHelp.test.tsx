import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useTaskStore } from '@/store/taskStore';

describe('KeyboardShortcutsHelp', () => {
  beforeEach(() => useTaskStore.setState({ helpOpen: false }));

  it('zobrazí tabulku zkratek když je otevřená', () => {
    useTaskStore.setState({ helpOpen: true });
    render(<KeyboardShortcutsHelp />);
    expect(screen.getByText('Klávesové zkratky')).toBeInTheDocument();
    expect(screen.getByText('Nový úkol')).toBeInTheDocument();
  });

  it('je skrytá když helpOpen=false', () => {
    render(<KeyboardShortcutsHelp />);
    expect(screen.queryByText('Klávesové zkratky')).not.toBeInTheDocument();
  });
});
