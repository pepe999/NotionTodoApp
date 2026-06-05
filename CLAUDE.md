# CLAUDE.md

Pokyny pro práci s tímto repozitářem (Claude Code / přispěvatelé).

## Co to je

Monorepo todo aplikace. Web (React) + iOS (SwiftUI) klient nad společným backendem (Fastify). Detailní postup je v [PLAN.md](./PLAN.md) – 9 fází, vyvíjej podle nich.

## Architektura ukládání dat (klíčové!)

- **Notion.so = primární databáze úkolů.** Každé čtení/zápis úkolu jde přes Notion API. Žádná lokální kopie úkolů, žádný sync problém.
- **SQLite na serveru ukládá POUZE auth data:**
  - `users` – Google profil
  - `sessions` – přihlašovací session (umožňuje logout/invalidaci)
  - `notion_configs` – **zašifrovaný** (AES-256-GCM) Notion token + Database ID
- **Podúkoly = nativní Notion Sub-items** (child stránky ve stejné databázi), viditelné i v Notionu.

## Workspaces

| Balíček | Název | Obsah |
|---------|-------|-------|
| `packages/api` | `@notiontodoapp/api` | Fastify 5, better-sqlite3, Notion klient, auth |
| `packages/web` | `@notiontodoapp/web` | React 19, Vite, Tailwind, Shadcn/ui |
| `packages/shared` | `@notiontodoapp/shared` | Zod schémata + typy sdílené mezi api a web |
| `packages/ios` | — | SwiftUI app. **NENÍ npm workspace.** Builď v Xcode. |

## Příkazy

```bash
npm install            # nainstaluje api + web + shared
npm run dev            # api (:3000) + web (:5173) ve watch módu
npm run build          # build všech balíčků
npm run test           # testy (Vitest)
npm run lint           # ESLint
npm run format         # Prettier
npm run typecheck      # tsc --noEmit per balíček
docker compose up      # lokální vývoj v kontejnerech
```

## Konvence

- **TypeScript strict** všude (viz `tsconfig.base.json`). Žádné `any`, preferuj generiky.
- **Validace na hranicích**: Zod schémata v `packages/shared` pro vstupy i výstupy API.
- **Bezpečnost** je prvořadá – viz revizní sekce v PLAN.md:
  - Notion token se nikdy nelogguje (Pino `redact`), v DB jen zašifrovaný (IV + auth tag zvlášť).
  - Notion API URL je hardcoded; `database_id`/`parent_id` se validují jako UUID (SSRF).
  - Cookie: HTTPOnly + Secure + SameSite=Lax; JWT alg whitelist (žádné `none`).
- **Notion rate limit ~3 req/s** – veškerá volání jdou přes sdílenou frontu (p-queue) + server-side cache.
- **Commit/PR**: vyvíjej na feature větvích, PR proti default větvi. Commit messages popisné, v češtině OK.
- **iOS** se needituje přes npm tooling; má vlastní SwiftLint.

## Kde co je

- Plán a stav prací: `PLAN.md`
- Sdílené typy: `packages/shared/src/`
- Infra (proxy/HTTPS): `infra/traefik/`
- CI/CD: `.github/workflows/`
