import { useEffect } from 'react';
import { useTaskStore } from '@/store/taskStore';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/** Globální klávesové zkratky (PLAN.md 3.10). */
export function useKeyboardShortcuts(): void {
  const store = useTaskStore;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const s = store.getState();
      switch (e.key) {
        case '1':
          s.setActiveView('kanban');
          break;
        case '2':
          s.setActiveView('timeline');
          break;
        case '3':
          s.setActiveView('calendar');
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          s.openCreate();
          break;
        case '?':
          s.setHelpOpen(true);
          break;
        case 'Escape':
          if (s.openTaskId) s.closeTask();
          else if (s.createOpen) s.closeCreate();
          else if (s.helpOpen) s.setHelpOpen(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
