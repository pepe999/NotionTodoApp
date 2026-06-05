# NotionTodoApp

Todo aplikace postavená nad **Notion.so** jako primární databází úkolů. Webový klient (React) i nativní iOS app (SwiftUI) nabízejí pohledy **Kanban / Timeline / Calendar** nad stejnými daty.

> **Notion je zdroj pravdy pro úkoly.** Aplikace volá Notion API při každém čtení i zápisu – úkoly jsou vždy vidět jak v této appce, tak přímo v Notionu. SQLite na serveru ukládá **pouze** auth data (uživatelé, sessions, zašifrovaný Notion token).

## Struktura monorepa

```
packages/
  api/       Backend API – Fastify 5 + TypeScript (Fáze 1)
  web/       Frontend – React 19 + Vite (Fáze 3)
  shared/    Sdílená Zod schémata a typy
  ios/       Nativní iOS app – SwiftUI (Fáze 5, buildí se lokálně v Xcode, NE v npm/Dockeru)
infra/
  traefik/   Reverse proxy + Let's Encrypt HTTPS
.github/workflows/   CI/CD pipeline
PLAN.md      Kompletní implementační plán (9 fází)
```

`packages/ios` záměrně **není** součástí npm workspaces – má vlastní Swift Package Manager závislosti.

## Požadavky

- Node.js **>= 20**
- Docker + Docker Compose v2 (lokální vývoj)
- Xcode 15+ (jen pro iOS)

## Začínáme

```bash
# 1. Instalace závislostí (api + web + shared)
npm install

# 2. Konfigurace prostředí
cp .env.example .env   # doplň hodnoty (JWT_SECRET, GOOGLE_*, NOTION_ENCRYPTION_KEY, …)

# 3a. Vývoj přes Docker (api :3000, web :5173)
docker compose up

# 3b. nebo lokálně
npm run dev
```

## Příkazy

| Příkaz | Popis |
|--------|-------|
| `npm run dev` | Spustí api + web v watch módu |
| `npm run build` | Build všech balíčků |
| `npm run test` | Testy všech balíčků |
| `npm run lint` | ESLint nad celým repozitářem |
| `npm run format` | Prettier formátování |
| `npm run typecheck` | Kontrola TypeScript typů |

## Dokumentace

- **[PLAN.md](./PLAN.md)** – detailní plán po fázích a podbodech
- **[CLAUDE.md](./CLAUDE.md)** – architektura a konvence pro vývoj

## Licence

Private.
