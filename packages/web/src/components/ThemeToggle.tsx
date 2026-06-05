import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

/** Přepínač light / dark / system s persistencí (PLAN.md 3.12). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Motiv: ${theme}. Přepnout na ${next}`}
      title={`Motiv: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
