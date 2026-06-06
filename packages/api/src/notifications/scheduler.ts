import type { Task } from '@notiontodoapp/shared';
import type { DB } from '../db/index';
import type { TokenCipher } from '../crypto/tokenCrypto';
import type { NotionService } from '../services/notion/service';
import type { ApnsSender } from '../apns/sender';
import { getNotionConfig, getDecryptedNotionConfig } from '../db/notionConfigs';
import {
  listAllDeviceTokens,
  listDeviceTokensForUser,
  markDeviceNotified,
  removeDeviceToken,
} from '../db/deviceTokens';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDue(s: string): number | null {
  const ts = Date.parse(s.length > 10 ? s : `${s}T00:00:00`);
  return Number.isNaN(ts) ? null : ts;
}

/** Úkoly s termínem v rozmezí [now, now+withinMs], které nejsou Done (čistá funkce, testovatelná). */
export function findDueSoon(tasks: Task[], now: number, withinMs = DAY_MS): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'Done' || !t.dueDate) return false;
    const due = parseDue(t.dueDate);
    if (due === null) return false;
    const diff = due - now;
    return diff >= 0 && diff <= withinMs;
  });
}

export interface SchedulerDeps {
  db: DB;
  cipher: TokenCipher;
  notion: NotionService;
  sender: ApnsSender;
}

/**
 * Projde uživatele s device tokeny, najde blížící se termíny a pošle push.
 * Coarse dedup: jedno zařízení dostane max jednu notifikaci za ~20 h
 * (last_notified_at). Neplatné tokeny (410) maže.
 */
export async function runDueNotifications(
  deps: SchedulerDeps,
  now: number = Date.now(),
): Promise<void> {
  const { db, cipher, notion, sender } = deps;
  const allTokens = listAllDeviceTokens(db);
  const userIds = [...new Set(allTokens.map((t) => t.user_id))];

  for (const userId of userIds) {
    if (!getNotionConfig(db, userId)) continue;
    const cfg = getDecryptedNotionConfig(db, cipher, userId);
    if (!cfg) continue;

    let due: Task[];
    try {
      const tasks = await notion.getTasks({ userId, token: cfg.token, databaseId: cfg.databaseId });
      due = findDueSoon(tasks, now);
    } catch {
      continue; // Notion chyba – zkusíme příště
    }
    if (due.length === 0) continue;

    const first = due[0];
    if (!first) continue;
    const title =
      due.length === 1 ? 'Blíží se termín úkolu' : `${due.length} úkolů má blízký termín`;

    for (const device of listDeviceTokensForUser(db, userId)) {
      if (device.last_notified_at && now - device.last_notified_at < 20 * 60 * 60 * 1000) continue;
      const result = await sender.send(device.token, { title, body: first.name, taskId: first.id });
      if (result.invalidToken) removeDeviceToken(db, device.token);
      else if (result.ok) markDeviceNotified(db, device.id, now);
    }
  }
}
