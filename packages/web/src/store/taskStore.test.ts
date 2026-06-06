import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore, hasActiveFilters } from './taskStore';

const reset = (): void =>
  useTaskStore.setState({
    activeView: 'kanban',
    openTaskId: null,
    createOpen: false,
    createParentId: null,
    createDefaultDue: null,
    filters: { search: '', tags: [], status: null },
    helpOpen: false,
  });

describe('taskStore', () => {
  beforeEach(reset);

  it('přepíná pohled', () => {
    useTaskStore.getState().setActiveView('calendar');
    expect(useTaskStore.getState().activeView).toBe('calendar');
  });

  it('open/close detailu a create modalu', () => {
    useTaskStore.getState().openTask('t1');
    expect(useTaskStore.getState().openTaskId).toBe('t1');
    useTaskStore.getState().closeTask();
    expect(useTaskStore.getState().openTaskId).toBeNull();

    useTaskStore.getState().openCreate({ parentId: 'p1', due: '2026-06-10' });
    expect(useTaskStore.getState().createOpen).toBe(true);
    expect(useTaskStore.getState().createParentId).toBe('p1');
    expect(useTaskStore.getState().createDefaultDue).toBe('2026-06-10');
    useTaskStore.getState().closeCreate();
    expect(useTaskStore.getState().createOpen).toBe(false);
  });

  it('toggluje tagy a status, reset vyčistí', () => {
    const s = useTaskStore.getState();
    s.toggleTag('work');
    s.toggleTag('home');
    s.toggleTag('work'); // odebere
    expect(useTaskStore.getState().filters.tags).toEqual(['home']);
    s.setStatus('Done');
    expect(useTaskStore.getState().filters.status).toBe('Done');
    expect(hasActiveFilters(useTaskStore.getState().filters)).toBe(true);
    useTaskStore.getState().resetFilters();
    expect(hasActiveFilters(useTaskStore.getState().filters)).toBe(false);
  });
});
