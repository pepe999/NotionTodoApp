import { create } from 'zustand';
import type { TaskStatus } from '@notiontodoapp/shared';

export type ViewKind = 'kanban' | 'timeline' | 'calendar' | 'todo';

interface Filters {
  search: string;
  tags: string[];
  status: TaskStatus | null;
}

interface TaskStore {
  activeView: ViewKind;
  setActiveView: (v: ViewKind) => void;

  /** ID otevřeného detailu úkolu (null = zavřeno). */
  openTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;

  /** Modal pro vytvoření úkolu. */
  createOpen: boolean;
  createParentId: string | null;
  createDefaultDue: string | null;
  openCreate: (opts?: { parentId?: string; due?: string }) => void;
  closeCreate: () => void;

  filters: Filters;
  setSearch: (s: string) => void;
  toggleTag: (tag: string) => void;
  setStatus: (s: TaskStatus | null) => void;
  resetFilters: () => void;

  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;

  /** Todo list pohled: skrýt hotové úkoly (přežívá přepínání pohledů). */
  todoHideDone: boolean;
  setTodoHideDone: (v: boolean) => void;
}

const emptyFilters: Filters = { search: '', tags: [], status: null };

export const useTaskStore = create<TaskStore>((set) => ({
  activeView: 'kanban',
  setActiveView: (v) => set({ activeView: v }),

  openTaskId: null,
  openTask: (id) => set({ openTaskId: id }),
  closeTask: () => set({ openTaskId: null }),

  createOpen: false,
  createParentId: null,
  createDefaultDue: null,
  openCreate: (opts) =>
    set({
      createOpen: true,
      createParentId: opts?.parentId ?? null,
      createDefaultDue: opts?.due ?? null,
    }),
  closeCreate: () => set({ createOpen: false, createParentId: null, createDefaultDue: null }),

  filters: emptyFilters,
  setSearch: (s) => set((st) => ({ filters: { ...st.filters, search: s } })),
  toggleTag: (tag) =>
    set((st) => {
      const has = st.filters.tags.includes(tag);
      return {
        filters: {
          ...st.filters,
          tags: has ? st.filters.tags.filter((t) => t !== tag) : [...st.filters.tags, tag],
        },
      };
    }),
  setStatus: (s) => set((st) => ({ filters: { ...st.filters, status: s } })),
  resetFilters: () => set({ filters: emptyFilters }),

  helpOpen: false,
  setHelpOpen: (v) => set({ helpOpen: v }),

  todoHideDone: false,
  setTodoHideDone: (v) => set({ todoHideDone: v }),
}));

export function hasActiveFilters(f: Filters): boolean {
  return f.search.trim() !== '' || f.tags.length > 0 || f.status !== null;
}
