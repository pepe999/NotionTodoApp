import { useTaskStore } from '@/store/taskStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['1 / 2 / 3 / 4', 'Kanban / Časová osa / Kalendář / Todo list'],
  ['N', 'Nový úkol'],
  ['?', 'Tato nápověda'],
  ['Esc', 'Zavřít okno'],
];

export function KeyboardShortcutsHelp() {
  const open = useTaskStore((s) => s.helpOpen);
  const setOpen = useTaskStore((s) => s.setHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Klávesové zkratky</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(([key, desc]) => (
              <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                    {key}
                  </kbd>
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
