import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useTaskStore } from '@/store/taskStore';

function Harness() {
  useKeyboardShortcuts();
  return null;
}

beforeEach(() =>
  useTaskStore.setState({
    activeView: 'kanban',
    createOpen: false,
    openTaskId: null,
    helpOpen: false,
  }),
);

describe('useKeyboardShortcuts', () => {
  it('přepíná pohledy, otevírá nový úkol a nápovědu', () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: '2' });
    expect(useTaskStore.getState().activeView).toBe('timeline');

    fireEvent.keyDown(window, { key: '3' });
    expect(useTaskStore.getState().activeView).toBe('calendar');

    fireEvent.keyDown(window, { key: 'n' });
    expect(useTaskStore.getState().createOpen).toBe(true);

    fireEvent.keyDown(window, { key: '?' });
    expect(useTaskStore.getState().helpOpen).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useTaskStore.getState().createOpen).toBe(false);
  });

  it('ignoruje zkratky při psaní v inputu', () => {
    render(
      <>
        <Harness />
        <input data-testid="inp" />
      </>,
    );
    const input = document.querySelector('input')!;
    input.focus();
    fireEvent.keyDown(input, { key: '2' });
    expect(useTaskStore.getState().activeView).toBe('kanban');
  });
});
