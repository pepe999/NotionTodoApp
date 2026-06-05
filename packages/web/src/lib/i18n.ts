/**
 * Centralizovaný slovník (PLAN.md 3.12 – příprava i18n). Výchozí jazyk čeština;
 * struktura umožňuje pozdější napojení i18next bez přepisování volání `t()`.
 */
const cs = {
  'app.title': 'NotionTodoApp',
  'nav.kanban': 'Kanban',
  'nav.timeline': 'Časová osa',
  'nav.calendar': 'Kalendář',
  'task.new': 'Nový úkol',
  'task.empty': 'Zatím žádné úkoly',
  'task.createFirst': 'Vytvořit první úkol',
  'common.save': 'Uložit',
  'common.cancel': 'Zrušit',
  'common.delete': 'Smazat',
  'common.undo': 'Vrátit zpět',
  'common.retry': 'Zkusit znovu',
  'common.loading': 'Načítání…',
  'auth.login': 'Přihlásit přes Google',
  'offline.banner': 'Ztráta spojení se serverem.',
} as const;

export type MessageKey = keyof typeof cs;

export function t(key: MessageKey): string {
  return cs[key];
}
