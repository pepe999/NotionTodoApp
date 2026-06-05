/**
 * Validace a normalizace Notion ID (PLAN.md 1.4).
 *
 * `database_id` / `parent_id` přicházejí od uživatele a interpolují se do API
 * cesty – PŘED použitím je tedy nutné je striktně ověřit (ochrana proti
 * path traversal / SSRF injection). Akceptujeme 32 hex znaků s pomlčkami i bez.
 */
const COMPACT_RE = /^[0-9a-f]{32}$/i;
const DASHED_OR_COMPACT_RE = /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi;

export class InvalidNotionIdError extends Error {
  constructor(raw: string) {
    super(`Neplatné Notion ID: ${raw}`);
    this.name = 'InvalidNotionIdError';
  }
}

/** True, pokud vstup je platné Notion ID (s pomlčkami nebo bez). */
export function isValidNotionId(raw: string): boolean {
  return COMPACT_RE.test(raw.replace(/-/g, ''));
}

/** Normalizuje Notion ID na dashed UUID formát. Vyhodí při neplatném vstupu. */
export function normalizeNotionId(raw: string): string {
  const compact = raw.replace(/-/g, '').toLowerCase();
  if (!COMPACT_RE.test(compact)) throw new InvalidNotionIdError(raw);
  return (
    `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-` +
    `${compact.slice(16, 20)}-${compact.slice(20)}`
  );
}

/**
 * Vytáhne database ID z raw ID nebo z Notion URL.
 * Notion URL má ID jako poslední 32-hex sekvenci (před `?v=…`).
 */
export function parseDatabaseId(input: string): string {
  const trimmed = input.trim();
  if (isValidNotionId(trimmed)) return normalizeNotionId(trimmed);
  const matches = trimmed.match(DASHED_OR_COMPACT_RE);
  if (matches && matches.length > 0) {
    return normalizeNotionId(matches[matches.length - 1] as string);
  }
  throw new InvalidNotionIdError(input);
}
