import { randomUUID } from 'node:crypto';
import type { DB } from './index';
import type { TokenCipher } from '../crypto/tokenCrypto';

/**
 * Přístup k tabulce `notion_configs` (PLAN.md 1.4).
 * Token je vždy uložen ZAŠIFROVANĚ (AES-256-GCM); plaintext nikdy nesahá do DB.
 */
export interface NotionConfigRow {
  id: string;
  user_id: string;
  integration_token_encrypted: string;
  token_iv: string;
  token_auth_tag: string;
  key_version: number;
  database_id: string;
  validated_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SaveNotionConfigParams {
  userId: string;
  token: string;
  databaseId: string;
  validatedAt: number | null;
}

/** Uloží (upsert) zašifrovanou Notion konfiguraci pro uživatele. */
export function saveNotionConfig(
  db: DB,
  cipher: TokenCipher,
  params: SaveNotionConfigParams,
  now: number = Date.now(),
): void {
  const enc = cipher.encrypt(params.token);
  const existing = getNotionConfig(db, params.userId);

  if (existing) {
    db.prepare(
      `UPDATE notion_configs
       SET integration_token_encrypted = ?, token_iv = ?, token_auth_tag = ?,
           key_version = ?, database_id = ?, validated_at = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      enc.ciphertext,
      enc.iv,
      enc.authTag,
      enc.keyVersion,
      params.databaseId,
      params.validatedAt,
      now,
      params.userId,
    );
    return;
  }

  db.prepare(
    `INSERT INTO notion_configs
       (id, user_id, integration_token_encrypted, token_iv, token_auth_tag,
        key_version, database_id, validated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    params.userId,
    enc.ciphertext,
    enc.iv,
    enc.authTag,
    enc.keyVersion,
    params.databaseId,
    params.validatedAt,
    now,
    now,
  );
}

export function getNotionConfig(db: DB, userId: string): NotionConfigRow | undefined {
  return db.prepare('SELECT * FROM notion_configs WHERE user_id = ?').get(userId) as
    | NotionConfigRow
    | undefined;
}

/** Načte a dešifruje token + databázi pro uživatele (pro Tasks API ve 1.5). */
export function getDecryptedNotionConfig(
  db: DB,
  cipher: TokenCipher,
  userId: string,
): { token: string; databaseId: string } | undefined {
  const row = getNotionConfig(db, userId);
  if (!row) return undefined;
  const token = cipher.decrypt({
    ciphertext: row.integration_token_encrypted,
    iv: row.token_iv,
    authTag: row.token_auth_tag,
    keyVersion: row.key_version,
  });
  return { token, databaseId: row.database_id };
}
