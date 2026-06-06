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
    activeView: 'calendar',
    createOpen: false,
    openTaskId: null,
    helpOpen: false,
  }),
);

describe('useKeyboardShortcuts – další větve', () => {
  it('klávesa 1 přepne na kanban', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: '1' });
    expect(useTaskStore.getState().activeView).toBe('kanban');
  });

  it('Escape zavře otevřený detail úkolu', () => {
    useTaskStore.setState({ openTaskId: 'x' });
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useTaskStore.getState().openTaskId).toBeNull();
  });

  it('Escape zavře nápovědu', () => {
    useTaskStore.setState({ helpOpen: true });
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useTaskStore.getState().helpOpen).toBe(false);
  });
});
