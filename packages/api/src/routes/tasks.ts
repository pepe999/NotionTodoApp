import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  createTaskInputSchema,
  updateTaskInputSchema,
  taskQuerySchema,
  taskSchema,
} from '@notiontodoapp/shared';
import type { DB } from '../db/index';
import type { TokenCipher } from '../crypto/tokenCrypto';
import { getDecryptedNotionConfig } from '../db/notionConfigs';
import type { NotionService } from '../services/notion/service';
import { normalizeNotionId } from '../services/notion/ids';
import { handleNotionError } from './notionError';
import { toJsonSchema, arrayOf } from '../lib/openapi';

export interface TasksRoutesOptions {
  db: DB;
  cipher: TokenCipher;
  notion: NotionService;
}

const idParamSchema = {
  type: 'object',
  properties: { id: { type: 'string', description: 'Notion ID úkolu' } },
  required: ['id'],
} as const;

const tasksRoutes: FastifyPluginAsync<TasksRoutesOptions> = async (app, opts) => {
  const { db, cipher, notion } = opts;

  /** preHandler: načte (dešifruje) Notion konfiguraci uživatele do req.notionCtx. */
  const loadNotionContext = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Nepřihlášeno.' });
      return;
    }
    const cfg = getDecryptedNotionConfig(db, cipher, userId);
    if (!cfg) {
      reply.status(400).send({
        error: 'SetupRequired',
        message: 'Nejdřív dokonči Notion setup (POST /api/setup/save).',
      });
      return;
    }
    req.notionCtx = { userId, token: cfg.token, databaseId: cfg.databaseId };
  };

  const preHandler = [app.authenticate, loadNotionContext];

  // --- GET /api/tasks (filtrovaný flat list) ---
  app.get(
    '/api/tasks',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Seznam úkolů (filtrovatelný)',
        querystring: toJsonSchema(taskQuerySchema),
        response: { 200: arrayOf(taskSchema) },
      },
    },
    async (req, reply) => {
      const q = taskQuerySchema.parse(req.query);
      const ctx = req.notionCtx!;
      try {
        let tasks = await notion.getTasks(ctx);
        if (q.parentId !== undefined) {
          const pid = normalizeNotionId(q.parentId);
          tasks = tasks.filter((t) => t.parentId === pid);
        }
        if (q.status) tasks = tasks.filter((t) => t.status === q.status);
        const tagList = q.tags
          ? q.tags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        if (tagList.length > 0) {
          tasks = tasks.filter((t) => tagList.every((tag) => t.tags.includes(tag)));
        }
        if (q.search) {
          const s = q.search.toLowerCase();
          tasks = tasks.filter(
            (t) => t.name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s),
          );
        }
        return reply.send(tasks);
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- POST /api/tasks ---
  app.post(
    '/api/tasks',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Vytvořit úkol',
        body: toJsonSchema(createTaskInputSchema),
        response: { 201: toJsonSchema(taskSchema) },
      },
    },
    async (req, reply) => {
      const input = createTaskInputSchema.parse(req.body);
      try {
        const task = await notion.createTask(req.notionCtx!, input);
        return reply.status(201).send(task);
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- GET /api/tasks/:id ---
  app.get(
    '/api/tasks/:id',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Detail úkolu',
        params: idParamSchema,
        response: { 200: toJsonSchema(taskSchema) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const task = await notion.getTask(req.notionCtx!, id);
        return reply.send(task);
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- PATCH /api/tasks/:id ---
  app.patch(
    '/api/tasks/:id',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Upravit úkol',
        params: idParamSchema,
        body: toJsonSchema(updateTaskInputSchema),
        response: { 200: toJsonSchema(taskSchema) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = updateTaskInputSchema.parse(req.body);
      try {
        const task = await notion.updateTask(req.notionCtx!, id, input);
        return reply.send(task);
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- DELETE /api/tasks/:id ---
  app.delete(
    '/api/tasks/:id',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Smazat úkol (archivovat v Notionu)',
        params: idParamSchema,
        response: { 204: { type: 'null' } },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        await notion.deleteTask(req.notionCtx!, id);
        return reply.status(204).send();
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- GET /api/tasks/:id/subtasks ---
  app.get(
    '/api/tasks/:id/subtasks',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Podúkoly daného úkolu',
        params: idParamSchema,
        response: { 200: arrayOf(taskSchema) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const pid = normalizeNotionId(id);
        const tasks = await notion.getTasks(req.notionCtx!);
        return reply.send(tasks.filter((t) => t.parentId === pid));
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );

  // --- POST /api/tasks/:id/subtasks ---
  app.post(
    '/api/tasks/:id/subtasks',
    {
      preHandler,
      schema: {
        tags: ['tasks'],
        summary: 'Vytvořit podúkol',
        params: idParamSchema,
        body: toJsonSchema(createTaskInputSchema),
        response: { 201: toJsonSchema(taskSchema) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = createTaskInputSchema.parse(req.body);
      try {
        const task = await notion.createSubtask(req.notionCtx!, id, input);
        return reply.status(201).send(task);
      } catch (err) {
        return handleNotionError(reply, err);
      }
    },
  );
};

export default fp(tasksRoutes, { name: 'tasks-routes' });
