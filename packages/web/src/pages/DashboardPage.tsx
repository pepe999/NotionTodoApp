import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Plus, Keyboard, LogOut } from 'lucide-react';
import { useTasksQuery } from '@/hooks/useTasks';
import { useTaskStore, type ViewKind } from '@/store/taskStore';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchBar } from '@/components/SearchBar';
import { TagFilter } from '@/components/TagFilter';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { KanbanView } from '@/views/KanbanView';

const TimelineView = lazy(() => import('@/views/TimelineView'));
const CalendarView = lazy(() => import('@/views/CalendarView'));
const TodoListView = lazy(() => import('@/views/TodoListView'));

const VIEWS: ReadonlyArray<{
  id: ViewKind;
  labelKey: 'nav.kanban' | 'nav.timeline' | 'nav.calendar' | 'nav.todo';
}> = [
  { id: 'kanban', labelKey: 'nav.kanban' },
  { id: 'timeline', labelKey: 'nav.timeline' },
  { id: 'calendar', labelKey: 'nav.calendar' },
  { id: 'todo', labelKey: 'nav.todo' },
];

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export function DashboardPage() {
  useKeyboardShortcuts();
  const { user, logout } = useAuth();
  const activeView = useTaskStore((s) => s.activeView);
  const setActiveView = useTaskStore((s) => s.setActiveView);
  const openCreate = useTaskStore((s) => s.openCreate);
  const setHelpOpen = useTaskStore((s) => s.setHelpOpen);

  const { isLoading, error } = useTasksQuery();

  // Bez Notion konfigurace backend vrací 400 SetupRequired → průvodce.
  if (
    error instanceof ApiError &&
    error.status === 400 &&
    (error.body as { error?: string } | undefined)?.error === 'SetupRequired'
  ) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <OfflineBanner />

      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="font-semibold">{t('app.title')}</span>

        <nav className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800" aria-label="Pohledy">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={activeView === v.id}
              onClick={() => setActiveView(v.id)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                activeView === v.id
                  ? 'bg-white shadow-sm dark:bg-zinc-950'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400',
              )}
            >
              {t(v.labelKey)}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <Button onClick={() => openCreate()} size="sm">
            <Plus className="h-4 w-4" /> {t('task.new')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            aria-label="Klávesové zkratky"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void logout()}
              aria-label="Odhlásit"
              title={user.email}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="border-b border-zinc-200 bg-white px-4 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <TagFilter />
      </div>

      <main className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex gap-4 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex w-72 flex-col gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <Suspense fallback={<ViewFallback />}>
            {activeView === 'kanban' && <KanbanView />}
            {activeView === 'timeline' && <TimelineView />}
            {activeView === 'calendar' && <CalendarView />}
            {activeView === 'todo' && <TodoListView />}
          </Suspense>
        )}
      </main>

      <CreateTaskModal />
      <TaskDetailModal />
      <KeyboardShortcutsHelp />
    </div>
  );
}
