import type { FastifyReply } from 'fastify';
import { NotionApiError } from '../services/notion/client';
import { InvalidNotionIdError } from '../services/notion/ids';

/**
 * Přeloží chyby Notion vrstvy na srozumitelné HTTP odpovědi.
 * Neznámé chyby přehodí dál (zachytí je globální error handler).
 */
export function handleNotionError(reply: FastifyReply, err: unknown): void {
  if (err instanceof InvalidNotionIdError) {
    reply.status(400).send({ error: 'InvalidNotionId', message: 'Neplatné Notion ID.' });
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
      reply.status(404).send({
        error: 'NotionNotFound',
        message: 'Záznam nenalezen v Notionu.',
      });
      return;
    }
    reply.status(502).send({ error: 'NotionUpstream', message: 'Chyba komunikace s Notion API.' });
    return;
  }
  throw err;
}
