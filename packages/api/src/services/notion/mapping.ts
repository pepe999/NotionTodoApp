import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from '@notiontodoapp/shared';
import { TASK_STATUSES } from '@notiontodoapp/shared';

/**
 * Mapování mezi Notion stránkami a doménovým modelem Task (PLAN.md 1.4).
 * Názvy sloupců jsou fixní (viz validace schématu). `Parent item` je nativní
 * Notion Sub-item relace – volitelná, používá se pro hierarchii podúkolů.
 */
export const TASK_COLUMNS = {
  name: 'Name',
  status: 'Status',
  tags: 'Tags',
  due: 'Due',
  timeline: 'Timeline',
  owner: 'Owner',
  description: 'Description',
  dependsOn: 'DependsOn',
  parent: 'Parent item',
} as const;

// --- Minimální typy Notion property/page (jen pole, která čteme) ---

interface RichTextItem {
  plain_text?: string;
}
interface NamedOption {
  id?: string;
  name?: string;
}
interface DateValue {
  start?: string | null;
  end?: string | null;
}
interface RefItem {
  id?: string;
}

interface NotionProperty {
  type?: string;
  title?: RichTextItem[];
  rich_text?: RichTextItem[];
  select?: NamedOption | null;
  multi_select?: NamedOption[];
  date?: DateValue | null;
  people?: RefItem[];
  relation?: RefItem[];
}

export interface NotionPage {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, NotionProperty>;
}

export interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

function isTaskStatus(value: string | undefined): value is TaskStatus {
  return value !== undefined && (TASK_STATUSES as readonly string[]).includes(value);
}

function plainText(items: RichTextItem[] | undefined): string {
  return (items ?? []).map((i) => i.plain_text ?? '').join('');
}

/** Notion stránka → Task. Tolerantní k chybějícím/odlišným polím. */
export function mapPageToTask(page: NotionPage): Task {
  const p = page.properties ?? {};
  const statusName = p[TASK_COLUMNS.status]?.select?.name;
  const tl = p[TASK_COLUMNS.timeline]?.date;
  const parentRel = (p[TASK_COLUMNS.parent]?.relation ?? [])
    .map((r) => r.id)
    .filter((id): id is string => Boolean(id));

  return {
    id: page.id,
    name: plainText(p[TASK_COLUMNS.name]?.title) || 'Bez názvu',
    status: isTaskStatus(statusName) ? statusName : 'Todo',
    tags: (p[TASK_COLUMNS.tags]?.multi_select ?? [])
      .map((o) => o.name)
      .filter((n): n is string => Boolean(n)),
    dueDate: p[TASK_COLUMNS.due]?.date?.start ?? null,
    timeline: tl?.start && tl.end ? { start: tl.start, end: tl.end } : null,
    ownerIds: (p[TASK_COLUMNS.owner]?.people ?? [])
      .map((x) => x.id)
      .filter((id): id is string => Boolean(id)),
    description: plainText(p[TASK_COLUMNS.description]?.rich_text),
    dependsOnIds: (p[TASK_COLUMNS.dependsOn]?.relation ?? [])
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id)),
    parentId: parentRel[0] ?? null,
    lastEditedTime: page.last_edited_time ?? '',
    url: page.url ?? '',
  };
}

/**
 * Task vstup → Notion `properties`. Zahrne jen pole, která jsou v `input`
 * přítomná (umožňuje částečný PATCH). `null` u date/relation pole vyčistí.
 */
export function taskInputToProperties(
  input: Partial<CreateTaskInput> | UpdateTaskInput,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  if (input.name !== undefined) {
    props[TASK_COLUMNS.name] = { title: [{ text: { content: input.name } }] };
  }
  if (input.status !== undefined) {
    props[TASK_COLUMNS.status] = { select: { name: input.status } };
  }
  if (input.tags !== undefined) {
    props[TASK_COLUMNS.tags] = { multi_select: input.tags.map((name) => ({ name })) };
  }
  if (input.dueDate !== undefined) {
    props[TASK_COLUMNS.due] = { date: input.dueDate ? { start: input.dueDate } : null };
  }
  if (input.timeline !== undefined) {
    props[TASK_COLUMNS.timeline] = {
      date: input.timeline ? { start: input.timeline.start, end: input.timeline.end } : null,
    };
  }
  if (input.ownerIds !== undefined) {
    props[TASK_COLUMNS.owner] = { people: input.ownerIds.map((id) => ({ id })) };
  }
  if (input.description !== undefined) {
    props[TASK_COLUMNS.description] = {
      rich_text: input.description ? [{ text: { content: input.description } }] : [],
    };
  }
  if (input.dependsOnIds !== undefined) {
    props[TASK_COLUMNS.dependsOn] = { relation: input.dependsOnIds.map((id) => ({ id })) };
  }
  if (input.parentId !== undefined) {
    props[TASK_COLUMNS.parent] = {
      relation: input.parentId ? [{ id: input.parentId }] : [],
    };
  }

  return props;
}
