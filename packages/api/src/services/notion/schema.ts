import type { ValidateResult, ColumnCheck } from '@notiontodoapp/shared';
import { TASK_STATUSES } from '@notiontodoapp/shared';
import { TASK_COLUMNS } from './mapping';

/**
 * Definice povinných sloupců Notion databáze a jejich validace (PLAN.md 1.4).
 * `DependsOn` je self-referencing relation; `Parent item` (nativní Sub-items)
 * je volitelný a do povinné validace nepatří.
 */
interface RequiredColumn {
  name: string;
  type: string;
  /** U `select` povinné volby. */
  selectOptions?: readonly string[];
}

export const REQUIRED_COLUMNS: readonly RequiredColumn[] = [
  { name: TASK_COLUMNS.name, type: 'title' },
  { name: TASK_COLUMNS.status, type: 'select', selectOptions: TASK_STATUSES },
  { name: TASK_COLUMNS.tags, type: 'multi_select' },
  { name: TASK_COLUMNS.due, type: 'date' },
  { name: TASK_COLUMNS.timeline, type: 'date' },
  { name: TASK_COLUMNS.owner, type: 'people' },
  { name: TASK_COLUMNS.description, type: 'rich_text' },
  { name: TASK_COLUMNS.dependsOn, type: 'relation' },
];

interface RetrievedProperty {
  type?: string;
  select?: { options?: { name?: string }[] };
}

export interface RetrievedDatabase {
  properties?: Record<string, RetrievedProperty>;
}

/** Ověří, že databáze obsahuje všech 8 povinných sloupců se správnými typy. */
export function checkDatabaseSchema(database: RetrievedDatabase): ValidateResult {
  const props = database.properties ?? {};

  const columns: ColumnCheck[] = REQUIRED_COLUMNS.map((req): ColumnCheck => {
    const found = props[req.name];
    if (!found) {
      return {
        column: req.name,
        expectedType: req.type,
        ok: false,
        actualType: null,
        message: 'Sloupec chybí.',
      };
    }
    if (found.type !== req.type) {
      return {
        column: req.name,
        expectedType: req.type,
        ok: false,
        actualType: found.type ?? null,
        message: `Očekáván typ "${req.type}", nalezen "${found.type ?? 'neznámý'}".`,
      };
    }
    if (req.selectOptions) {
      const present = new Set((found.select?.options ?? []).map((o) => o.name));
      const missing = req.selectOptions.filter((o) => !present.has(o));
      if (missing.length > 0) {
        return {
          column: req.name,
          expectedType: req.type,
          ok: false,
          actualType: found.type ?? null,
          message: `Chybí volby: ${missing.join(', ')}.`,
        };
      }
    }
    return {
      column: req.name,
      expectedType: req.type,
      ok: true,
      actualType: found.type ?? null,
      message: null,
    };
  });

  return { valid: columns.every((c) => c.ok), columns };
}

/** Payload pro vytvoření nové databáze se správným schématem (bez self-relace). */
export function buildCreateDatabasePayload(parentPageId: string, title: string): unknown {
  const statusColors = ['default', 'blue', 'yellow', 'green'];
  return {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: title } }],
    properties: {
      [TASK_COLUMNS.name]: { title: {} },
      [TASK_COLUMNS.status]: {
        select: {
          options: TASK_STATUSES.map((name, i) => ({ name, color: statusColors[i] ?? 'default' })),
        },
      },
      [TASK_COLUMNS.tags]: { multi_select: {} },
      [TASK_COLUMNS.due]: { date: {} },
      [TASK_COLUMNS.timeline]: { date: {} },
      [TASK_COLUMNS.owner]: { people: {} },
      [TASK_COLUMNS.description]: { rich_text: {} },
    },
  };
}

/** Payload pro doplnění self-referencing `DependsOn` relace (zná-li se už ID). */
export function buildSelfRelationPayload(databaseId: string): unknown {
  return {
    properties: {
      [TASK_COLUMNS.dependsOn]: {
        relation: { database_id: databaseId, type: 'single_property', single_property: {} },
      },
    },
  };
}
