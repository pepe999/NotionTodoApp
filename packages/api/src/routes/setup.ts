import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { setupInputSchema, createDatabaseInputSchema } from '@notiontodoapp/shared';
import type { DB } from '../db/index';
import type { TokenCipher } from '../crypto/tokenCrypto';
import { saveNotionConfig } from '../db/notionConfigs';
import type { NotionService } from '../services/notion/service';
import { NotionApiError } from '../services/notion/client';
import { InvalidNotionIdError, parseDatabaseId } from '../services/notion/ids';

export interface SetupRoutesOptions {
  db: DB;
  cipher: TokenCipher;
  notion: NotionService;
}

/** Přeloží chyby Notion vrstvy na srozumitelné HTTP odpovědi. Ostatní necháme bublat. */
function handleNotionError(reply: FastifyReply, err: unknown): void {
  if (err instanceof InvalidNotionIdError) {
    reply.status(400).send({ error: 'InvalidNotionId', message: 'Neplatné ID databáze.' });
    return;
  }
  if (err instanceof NotionApiError) {
    if (err.status === 401 || err.status === 403) {
      reply.status(400).send({
        error: 'NotionAuth',
        message: 'Notion odmítl token nebo přístup k databázi. Zkontroluj token a sdílení.',
      });
      return;
    }
    if (err.status === 404) {
      reply.status(400).send({
        error: 'NotionNotFound',
        message: 'Databáze nenalezena. Je sdílená s integrací?',
      });
      return;
    }
    reply.status(502).send({ error: 'NotionUpstream', message: 'Chyba komunikace s Notion API.' });
    return;
  }
  throw err;
}

const setupRoutes: FastifyPluginAsync<SetupRoutesOptions> = async (app, opts) => {
  const { db, cipher, notion } = opts;

  // --- Validace databáze (bez uložení) ---
  app.post('/api/setup/validate', { preHandler: app.authenticate }, async (req, reply) => {
    const input = setupInputSchema.parse(req.body);
    try {
      const databaseId = parseDatabaseId(input.databaseId);
      const result = await notion.validateDatabase(input.token, databaseId);
      return reply.send(result);
    } catch (err) {
      return handleNotionError(reply, err);
    }
  });

  // --- Validace + uložení zašifrované konfigurace ---
  app.post('/api/setup/save', { preHandler: app.authenticate }, async (req, reply) => {
    const input = setupInputSchema.parse(req.body);
    try {
      const databaseId = parseDatabaseId(input.databaseId);
      const result = await notion.validateDatabase(input.token, databaseId);
      if (!result.valid) {
        return reply.status(400).send({
          error: 'InvalidDatabase',
          message: 'Databáze nesplňuje požadované schéma.',
          columns: result.columns,
        });
      }
      const now = Date.now();
      saveNotionConfig(
        db,
        cipher,
        { userId: req.user!.id, token: input.token, databaseId, validatedAt: now },
        now,
      );
      return reply.send({ ok: true, databaseId, validatedAt: now });
    } catch (err) {
      return handleNotionError(reply, err);
    }
  });

  // --- Volitelné: vytvoření nové databáze se správným schématem ---
  app.post('/api/setup/create-database', { preHandler: app.authenticate }, async (req, reply) => {
    const input = createDatabaseInputSchema.parse(req.body);
    try {
      const databaseId = await notion.createDatabase(input.token, input.parentPageId, input.title);
      return reply.send({ databaseId });
    } catch (err) {
      return handleNotionError(reply, err);
    }
  });
};

export default fp(setupRoutes, { name: 'setup-routes' });
