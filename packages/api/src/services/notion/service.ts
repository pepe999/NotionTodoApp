import type { Task, CreateTaskInput, UpdateTaskInput, ValidateResult } from '@notiontodoapp/shared';
import { NotionClient } from './client';
import { TtlCache } from './cache';
import { normalizeNotionId } from './ids';
import {
  mapPageToTask,
  taskInputToProperties,
  type NotionPage,
  type NotionQueryResponse,
} from './mapping';
import {
  checkDatabaseSchema,
  buildCreateDatabasePayload,
  buildSelfRelationPayload,
  type RetrievedDatabase,
} from './schema';

const TASKS_CACHE_TTL_MS = 20_000;
const QUERY_PAGE_SIZE = 100;

/** Kontext jednoho uživatele (jeho Notion token + databáze). */
export interface NotionContext {
  userId: string;
  token: string;
  databaseId: string;
}

/**
 * Vysokoúrovňová Notion služba (PLAN.md 1.4).
 * Sdílí jeden klient (rate-limit fronta) a per-user cache napříč requesty –
 * proto je určená jako singleton (instancuje se v buildServer).
 */
export class NotionService {
  private readonly client: NotionClient;
  private readonly cache: TtlCache<Task[]>;

  constructor(opts: { client?: NotionClient; cache?: TtlCache<Task[]> } = {}) {
    this.client = opts.client ?? new NotionClient();
    this.cache = opts.cache ?? new TtlCache<Task[]>(TASKS_CACHE_TTL_MS);
  }

  /** Ověří existenci a typy povinných sloupců databáze. */
  async validateDatabase(token: string, databaseId: string): Promise<ValidateResult> {
    const id = normalizeNotionId(databaseId);
    const database = await this.client.request<RetrievedDatabase>(token, 'GET', `/databases/${id}`);
    return checkDatabaseSchema(database);
  }

  /** Vrátí kompletní flat list úkolů (s plným stránkováním). Cachováno per-user. */
  async getTasks(ctx: NotionContext): Promise<Task[]> {
    const cached = this.cache.get(ctx.userId);
    if (cached) return cached;

    const id = normalizeNotionId(ctx.databaseId);
    const tasks: Task[] = [];
    let cursor: string | undefined;

    do {
      const body: Record<string, unknown> = { page_size: QUERY_PAGE_SIZE };
      if (cursor) body.start_cursor = cursor;
      const page = await this.client.request<NotionQueryResponse>(
        ctx.token,
        'POST',
        `/databases/${id}/query`,
        body,
      );
      for (const result of page.results) tasks.push(mapPageToTask(result));
      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);

    this.cache.set(ctx.userId, tasks);
    return tasks;
  }

  /** Vytvoří úkol; write-through invaliduje cache. */
  async createTask(ctx: NotionContext, input: CreateTaskInput): Promise<Task> {
    const id = normalizeNotionId(ctx.databaseId);
    const page = await this.client.request<NotionPage>(ctx.token, 'POST', '/pages', {
      parent: { database_id: id },
      properties: taskInputToProperties(input),
    });
    this.cache.delete(ctx.userId);
    return mapPageToTask(page);
  }

  /** Vytvoří podúkol (nativní Notion Sub-item) pod daným rodičem. */
  async createSubtask(ctx: NotionContext, parentId: string, input: CreateTaskInput): Promise<Task> {
    return this.createTask(ctx, { ...input, parentId: normalizeNotionId(parentId) });
  }

  /** Upraví úkol (částečný PATCH); write-through invaliduje cache. */
  async updateTask(ctx: NotionContext, taskId: string, input: UpdateTaskInput): Promise<Task> {
    const id = normalizeNotionId(taskId);
    const page = await this.client.request<NotionPage>(ctx.token, 'PATCH', `/pages/${id}`, {
      properties: taskInputToProperties(input),
    });
    this.cache.delete(ctx.userId);
    return mapPageToTask(page);
  }

  /** Smaže úkol (Notion archivuje stránku); write-through invaliduje cache. */
  async deleteTask(ctx: NotionContext, taskId: string): Promise<void> {
    const id = normalizeNotionId(taskId);
    await this.client.request(ctx.token, 'PATCH', `/pages/${id}`, { archived: true });
    this.cache.delete(ctx.userId);
  }

  /**
   * Volitelně vytvoří novou databázi se správným schématem (8 sloupců).
   * Self-referencing `DependsOn` relace se doplní druhým voláním (potřebuje ID).
   */
  async createDatabase(token: string, parentPageId: string, title: string): Promise<string> {
    const parent = normalizeNotionId(parentPageId);
    const created = await this.client.request<{ id: string }>(
      token,
      'POST',
      '/databases',
      buildCreateDatabasePayload(parent, title),
    );
    const newId = normalizeNotionId(created.id);
    await this.client.request(
      token,
      'PATCH',
      `/databases/${newId}`,
      buildSelfRelationPayload(newId),
    );
    return newId;
  }
}
