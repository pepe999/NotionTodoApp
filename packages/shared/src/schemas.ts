import { z } from 'zod';

/**
 * Sdílená Zod schémata pro úkoly a Notion setup (PLAN.md 1.4 + 1.5).
 *
 * Hodnoty statusů jsou ZÁMĚRNĚ shodné s názvy Notion `select` voleb
 * ("In Progress" se mezerou) – musí přesně odpovídat, aby čtení i zápis
 * do Notionu fungovaly bez další mapovací vrstvy.
 */
export const TASK_STATUSES = ['Todo', 'In Progress', 'Review', 'Done'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Časové rozpětí (Notion `date` s start+end) pro Timeline/Gantt. */
export const timelineSchema = z.object({
  start: z.string(),
  end: z.string(),
});
export type Timeline = z.infer<typeof timelineSchema>;

/** Úkol tak, jak ho appka čte z Notionu (flat list; hierarchie přes `parentId`). */
export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: taskStatusSchema,
  tags: z.array(z.string()),
  /** Date-only ISO (YYYY-MM-DD) nebo datetime; null pokud není nastaveno. */
  dueDate: z.string().nullable(),
  timeline: timelineSchema.nullable(),
  ownerIds: z.array(z.string()),
  description: z.string(),
  dependsOnIds: z.array(z.string()),
  /** ID nadřazeného úkolu (nativní Notion Sub-item), null u top-level. */
  parentId: z.string().nullable(),
  lastEditedTime: z.string(),
  url: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

/** Vstup pro vytvoření úkolu. */
export const createTaskInputSchema = z.object({
  name: z.string().min(1).max(2000),
  status: taskStatusSchema.default('Todo'),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().nullable().optional(),
  timeline: timelineSchema.nullable().optional(),
  ownerIds: z.array(z.string()).default([]),
  description: z.string().optional(),
  dependsOnIds: z.array(z.string()).default([]),
  parentId: z.string().nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/** Vstup pro úpravu úkolu – všechna pole volitelná (PATCH). */
export const updateTaskInputSchema = createTaskInputSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/**
 * Query parametry pro `GET /api/tasks`. Filtrace probíhá server-side nad
 * cachovaným seznamem. `tags` je čárkami oddělený seznam (AND sémantika).
 */
export const taskQuerySchema = z.object({
  search: z.string().optional(),
  status: taskStatusSchema.optional(),
  tags: z.string().optional(),
  parentId: z.string().optional(),
});
export type TaskQuery = z.infer<typeof taskQuerySchema>;

// --- Setup wizard (Notion integrace) ---

/** Vstup pro validaci/uložení Notion konfigurace. `databaseId` smí být i URL. */
export const setupInputSchema = z.object({
  token: z.string().min(1),
  databaseId: z.string().min(1),
});
export type SetupInput = z.infer<typeof setupInputSchema>;

/** Výsledek kontroly jednoho povinného sloupce databáze. */
export const columnCheckSchema = z.object({
  column: z.string(),
  expectedType: z.string(),
  ok: z.boolean(),
  actualType: z.string().nullable(),
  message: z.string().nullable(),
});
export type ColumnCheck = z.infer<typeof columnCheckSchema>;

/** Výsledek validace celé databáze (8 sloupců). */
export const validateResultSchema = z.object({
  valid: z.boolean(),
  columns: z.array(columnCheckSchema),
});
export type ValidateResult = z.infer<typeof validateResultSchema>;

/** Vstup pro volitelné vytvoření nové databáze se správným schématem. */
export const createDatabaseInputSchema = z.object({
  token: z.string().min(1),
  parentPageId: z.string().min(1),
  title: z.string().min(1).max(200).default('Tasks'),
});
export type CreateDatabaseInput = z.infer<typeof createDatabaseInputSchema>;
