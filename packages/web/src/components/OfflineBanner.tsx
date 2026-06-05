import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { TASKS_KEY } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/** Banner při výpadku spojení (PLAN.md 3.11). */
export function OfflineBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = (): void => setOffline(false);
    const off = (): void => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-sm text-amber-950"
    >
      <WifiOff className="h-4 w-4" />
      {t('offline.banner')}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-amber-950 hover:bg-amber-600"
        onClick={() => void qc.invalidateQueries({ queryKey: TASKS_KEY })}
      >
        {t('common.retry')}
      </Button>
    </div>
  );
}
