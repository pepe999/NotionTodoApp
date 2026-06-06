import { useTaskStore, hasActiveFilters } from '@/store/taskStore';
import { useAllTags } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function TagFilter() {
  const tags = useAllTags();
  const filters = useTaskStore((s) => s.filters);
  const toggleTag = useTaskStore((s) => s.toggleTag);
  const reset = useTaskStore((s) => s.resetFilters);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const active = filters.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => toggleTag(tag)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              active
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
            )}
          >
            {tag}
          </button>
        );
      })}
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset filtrů
        </Button>
      )}
    </div>
  );
}
