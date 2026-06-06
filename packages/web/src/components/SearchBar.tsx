import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';

export function SearchBar() {
  const setSearch = useTaskStore((s) => s.setSearch);
  const [value, setValue] = useState('');
  const debounced = useDebouncedValue(value, 300);

  useEffect(() => {
    setSearch(debounced);
  }, [debounced, setSearch]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Hledat úkoly…"
        className="pl-8"
        aria-label="Hledat úkoly"
      />
    </div>
  );
}
