# NotionTodoApp – Implementační plán

## Legenda stavů

| Symbol | Význam |
|--------|--------|
| `[ ]` | Čeká na zahájení |
| `[~]` | Probíhá |
| `[x]` | Hotovo |
| `[!]` | Blokováno / vyžaduje pozornost |

**Kdo dělá co:**
- `[Claude]` – Claude Code provede samostatně na základě zadání
- `[Uživatel]` – Manuální kroky (klikání v prohlížeči, terminál, konfigurace)
- `[Claude+Uživatel]` – Spolupráce (Claude připraví, uživatel doplní citlivé údaje)

---

## Architektura ukládání dat

> **Notion.so je primární databáze pro všechny úkoly.**
>
> Aplikace volá Notion API při každém čtení i zápisu – úkoly jsou tedy vždy vidět jak v této appce, tak přímo v Notionu. Neexistuje žádná lokální kopie ani sync problém.
>
> **SQLite na serveru ukládá pouze:**
> - `users` – Google profil (id, email, jméno, avatar)
> - `sessions` – přihlašovací session záznamy (umožňují logout a invalidaci)
> - `notion_configs` – zašifrovaný Notion integration token + Database ID
>
> **Notion databáze ukládá:**
> - Všechny úkoly a jejich pole (Name, Status, Tags, Due, Timeline, Owner, Description, DependsOn)
> - Podúkoly jako nativní Sub-items (child stránky ve stejné databázi – viditelné v Notionu jako "Sub-items" pod nadřazeným úkolem)

---

## Přehled fází (checklist)

- [~] **FÁZE 0** – Příprava a infrastruktura _(hotovo: 0.1–0.4 + branch protection na main, 0.5/0.6 splněny STÁVAJÍCÍM serverem, 0.7 deploy secrets `VPS_*`; **ZBÝVÁ: vytvořit Google OAuth client** – viz „Skutečný stav infrastruktury" níže)_
- [~] **FÁZE 1** – Backend API (Fastify + TypeScript) _(hotovo: 1.1 setup, 1.2 SQLite+AES-GCM, 1.3 Google OAuth+PKCE+sessions+/auth/mobile, 1.4 Notion service + setup endpointy)_
- [ ] **FÁZE 2** – Testy backendu
- [ ] **FÁZE 3** – Frontend Web (React + Vite)
- [ ] **FÁZE 4** – Testy frontendu
- [ ] **FÁZE 5** – iOS (SwiftUI)
- [ ] **FÁZE 6** – Bezpečnostní audit
- [ ] **FÁZE 7** – Nasazení
- [ ] **FÁZE 8** – Finální revize

---

## FÁZE 0: Příprava a infrastruktura

> ### ⚙️ Skutečný stav infrastruktury (aktualizováno 2026-06-05)
>
> Původní sekce 0.5–0.7 popisují setup „od nuly" na novém serveru. **Realita je jiná** –
> aplikace se nasazuje na už existující, plně provozovaný server. Tato poznámka je
> závazná; podsekce 0.5/0.6/0.7 ber přes ni.
>
> **Server (Hetzner):** `46.225.77.14`, hostname `PepaVPS`, **Ubuntu 24.04, ARM / aarch64**.
> Už na něm běží 6 aplikací (vč. staré `notion-todo` na `todo.josefbina.cz`).
> - Docker 29 + Compose v5 **už nainstalováno**.
> - **Traefik v3.6 už běží** (`/opt/apps/traefik`, síť `traefik-public`, Let's Encrypt).
>   → Adresář `infra/traefik/` v tomto repu se **NEPOUŽIJE** (server má vlastní Traefik).
> - Firewall řeší **Hetzner Cloud Firewall**, `ufw` je záměrně vypnuté.
> - **Žádný `deploy` uživatel** – appky běží jako `root` v `/opt/apps/<jméno>`, build lokálně.
>
> **Deploy model = A (lokální build na serveru).** Zvoleno kvůli ARM (amd64 image z GHCR
> by neběžel) a kvůli konzistenci se zbytkem serveru. GHCR se nepoužívá, `GHCR_TOKEN`
> není potřeba. `deploy.yml` přepsán (SSH → `git reset origin/main` → `docker compose
> build & up` → health check → rollback), trigger dočasně `workflow_dispatch`.
>
> **Cílový adresář na serveru (Fáze 7):** `/opt/apps/notion-todo-app` (oddělený od staré
> `notion-todo`, aby `todo.josefbina.cz` jelo dál až do přepnutí).
>
> **GitHub Secrets – stav (model A čte z GH Secrets jen `VPS_*`):**
> | Secret | Stav | Pozn. |
> |--------|------|-------|
> | `VPS_HOST` = `46.225.77.14` | ✅ nastaveno | |
> | `VPS_USER` = `root` | ✅ nastaveno | |
> | `VPS_SSH_KEY` | ✅ nastaveno | vyhrazený `github_deploy` klíč, autorizovaný pro root |
> | `JWT_SECRET` | ✅ vygenerováno | u modelu A **patří do server `.env`**, ne do GH Secrets – ponecháno jako reference |
> | `NOTION_ENCRYPTION_KEY` | ✅ vygenerováno | dtto |
> | `DOMAIN` = `todo.josefbina.cz` | ✅ nastaveno | dtto |
> | `GHCR_TOKEN` | ❌ netřeba | model A nebuildí v GHCR |
> | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ❌ **ZBÝVÁ** | viz TODO níže |
>
> **Branch protection na `main`:** ✅ nastaveno (PR povinné, 0 schválení, zákaz force-push/mazání).
>
> ---
>
> ### ✅ TODO – co ještě dodělat ve Fázi 0
>
> 1. **Vytvořit Google OAuth client** (Google Cloud Console → APIs & Services):
>    - OAuth consent screen: **External**, app `NotionTodoApp`, přidat se jako **Test user**.
>    - Credentials → OAuth client ID → **Web application**.
>    - **Authorized JavaScript origins:** `http://localhost:5173`, `http://localhost:3000`
>    - **Authorized redirect URIs:**
>      - `http://localhost:3000/auth/google/callback` (dev – odpovídá routě v `packages/api/src/plugins/auth.ts`)
>      - `https://todo.josefbina.cz/auth/google/callback` (prod – doladí se ve Fázi 7)
>    - Výsledný **Client ID** a **Client Secret** ulož do **lokálního `.env`** (dev) – `.env`
>      v repu zatím není, vytvoř z `.env.example` a doplň i `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`.
>      `JWT_SECRET` a `NOTION_ENCRYPTION_KEY` pro dev vygeneruj (`openssl rand -base64 64` / `-hex 32`).
>    - Tytéž hodnoty (Google creds + JWT + NOTION_ENCRYPTION_KEY) půjdou ve **Fázi 7** do
>      serverového `/opt/apps/notion-todo-app/.env` (NE do GitHub Secrets).
> 2. *(volitelné)* `iOS` Google client ID (`GOOGLE_IOS_CLIENT_ID`) až ve **Fázi 5**.
>
> Tím je Fáze 0 hotová. Vlastní nasazení (naklonovat repo do `/opt/apps/notion-todo-app`,
> produkční Dockerfiles + produkční compose s Traefik labely pro `todo.josefbina.cz`,
> přepnutí ze staré appky, odkomentovat `push: main` v `deploy.yml`) je náplň **Fáze 7**.

### 0.1 Git repozitář a větve strategie

- **Popis**: Inicializace Git repozitáře s ochranami větví a jasnou strategií větvení (main = produkce, develop = integrace, feature/* = funkce, hotfix/* = opravy).
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: GitHub účet, název repozitáře
- **Výstup**: Repozitář s nastavenými branch protection rules, `.gitignore`, `README.md`
- **Testy/Revize**: Push na main selže bez PR; CI běží na PR
- **Claude Code zadání**: `Inicializuj Git repozitář, vytvoř .gitignore pro Node.js/TypeScript/Swift/Docker (včetně *.xcuserstate, .DS_Store, *.env, data/*.sqlite), vytvoř základní adresářovou strukturu monorepa a commitni. Přidej také .env.example se všemi proměnnými bez hodnot (JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NOTION_ENCRYPTION_KEY, FRONTEND_URL, DATABASE_PATH, PORT).`
- **Technologie/nástroje**: Git, GitHub
- **Manuální kroky (Uživatel)**:
  1. Jdi na https://github.com/new, vytvoř repozitář `NotionTodoApp` (private)
  2. Settings → Branches → Add rule: větev `main`, zaškrtni "Require pull request before merging", "Require status checks to pass"
  3. Zkopíruj remote URL a spusť: `git remote add origin <URL>`

---

### 0.2 Monorepo struktura

- **Popis**: Nastavení monorepa s npm workspaces. Struktura: `packages/api`, `packages/web`, `packages/shared` (sdílené Zod schémata, typy). iOS je v `packages/ios/` jako adresář, ale **není součástí npm workspaces** – Xcode projekt má vlastní Swift Package Manager závislosti.
- **Kdo**: `[Claude]`
- **Vstup**: Inicializovaný Git repozitář
- **Výstup**: `package.json` s workspaces `["packages/api", "packages/web", "packages/shared"]`, `tsconfig.base.json`, adresářová kostra, `CLAUDE.md` s popisem architektury a příkazy
- **Testy/Revize**: `npm install` z kořene nainstaluje závislosti api, web, shared; `packages/ios` je ignorován npm
- **Claude Code zadání**: `Vytvoř monorepo strukturu: kořenový package.json s workspaces ["packages/api", "packages/web", "packages/shared"] (iOS záměrně vynecháno), tsconfig.base.json se striktním TypeScriptem, prázdné package.json pro packages/api, packages/web, packages/shared. Přidej základní ESLint a Prettier konfig na kořenové úrovni. Vytvoř CLAUDE.md s popisem architektury (Notion jako DB pro úkoly, SQLite jen pro auth), příkazy npm run dev/test/build, a konvencemi.`
- **Technologie/nástroje**: npm workspaces, TypeScript 5.x, ESLint 9.x, Prettier 3.x

---

### 0.3 Docker + docker-compose pro lokální vývoj

- **Popis**: Docker Compose konfigurace pro lokální vývoj: api (Node.js s hot-reload), web (Vite dev server), sqlite volume. **iOS se buildí výhradně lokálně v Xcode – není součástí Dockeru.**
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura z 0.2
- **Výstup**: `docker-compose.yml`, `docker-compose.override.yml` (dev overrides: volume mounts, debug porty), `packages/api/Dockerfile.dev`, `packages/web/Dockerfile.dev`
- **Testy/Revize**: `docker compose up` spustí api a web; api dostupné na :3000, web na :5173
- **Claude Code zadání**: `Vytvoř docker-compose.yml s službami: api (Node 20 Alpine, volume mount pro hot-reload, port 3000), web (Node 20 Alpine, Vite, port 5173), sqlite-data named volume pro /data adresář. Vytvoř docker-compose.override.yml pro dev: NODE_ENV=development, tsx watch příkaz. Přidej .dockerignore soubory. Použij named volumes pro node_modules.`
- **Technologie/nástroje**: Docker 24+, Docker Compose v2, Node 20 Alpine

---

### 0.4 CI/CD GitHub Actions pipeline

- **Popis**: GitHub Actions workflow pro CI (lint, test, build) na každém PR a CD (deploy na VPS) při merge do main. iOS CI je **volitelný samostatný job** na `macos-latest` runneru (výrazně dražší minuty – výchozí stav: vypnuto, aktivovat ručně).
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura, Docker soubory
- **Výstup**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/ios-ci.yml` (disabled by default)
- **Testy/Revize**: Push PR spustí CI (lint + test + build pro api a web); merge do main spustí deploy workflow
- **Claude Code zadání**: `Vytvoř GitHub Actions ci.yml: spustí se na PR do main/develop, kroky: gitleaks secret scan, checkout, setup Node 20 s cache, npm ci, npm run lint, npm audit --audit-level=moderate, npm run test (s coverage), npm run build, size-limit kontrola bundle. Přidej SAST (CodeQL nebo semgrep), dependency-review action (blokuje PR se zranitelnými deps) a Trivy scan výsledných Docker images (CRITICAL/HIGH fail). Práva workflow: nejmenší nutná (permissions: contents: read), pin actions na commit SHA, concurrency cancel-in-progress. Vytvoř deploy.yml: na push do main – build Docker images, push na GHCR, SSH deploy na VPS přes appleboy/ssh-action s rollback krokem. Vytvoř ios-ci.yml s workflow_dispatch triggerem (manuální): macos-latest runner, xcodebuild test.`
- **Technologie/nástroje**: GitHub Actions, GHCR, appleboy/ssh-action

---

### 0.5 VPS server setup

> ✅ **SPLNĚNO stávajícím serverem** – viz „Skutečný stav infrastruktury" výše.
> Server existuje, Docker/firewall/Traefik hotové. Kroky níže (nový server, `deploy`
> uživatel, `ufw`) se **neprovádějí** – neodpovídají realitě (root + Hetzner FW).

- **Popis**: Příprava Ubuntu VPS serveru – instalace Dockeru, nastavení firewallu, SSH klíče, uživatel pro deploy.
- **Kdo**: `[Uživatel]` (manuální kroky)
- **Vstup**: Hetzner nebo DigitalOcean účet
- **Výstup**: VPS s Ubuntu 22.04, Docker, firewall, deploy uživatel
- **Testy/Revize**: SSH přihlášení funguje; `docker ps` běží bez sudo
- **Manuální kroky**:
  1. Na https://console.hetzner.cloud vyber "New Server": Ubuntu 22.04, **CPX21** (2 vCPU, 4GB RAM) – poznámka: starý název CX21 byl přejmenován na CPX21
  2. Přidej svůj SSH veřejný klíč při vytváření serveru
  3. SSH na server: `ssh root@<VPS_IP>`
  4. Aktualizuj systém: `apt update && apt upgrade -y`
  5. Vytvoř deploy uživatele: `adduser deploy && usermod -aG sudo deploy && usermod -aG docker deploy`
  6. Nainstaluj Docker: `curl -fsSL https://get.docker.com | sh`
  7. Nastav firewall: `ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable`
  8. Zkopíruj SSH klíč pro deploy uživatele: `mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh`
  9. Vygeneruj deploy SSH klíč (pro GitHub Actions): `ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy` – přidej public key do `/home/deploy/.ssh/authorized_keys`

---

### 0.6 Traefik + HTTPS setup

> ✅ **SPLNĚNO stávajícím serverem** – Traefik v3.6 už běží (`/opt/apps/traefik`),
> `todo.josefbina.cz` na server míří. Adresář `infra/traefik/` v repu se **nepoužije**
> (jeho `traefik.yml` e-mail je tedy bezpředmětný). Produkční Traefik labely pro appku
> se přidají do produkčního compose ve **Fázi 7**.

- **Popis**: Traefik jako reverse proxy s automatickým Let's Encrypt HTTPS certifikátem.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: VPS z 0.5, doména
- **Výstup**: `infra/traefik/docker-compose.yml`, `infra/traefik/traefik.yml`, HTTPS funkční
- **Testy/Revize**: `curl https://yourdomain.com` vrátí 200; certifikát je platný
- **Claude Code zadání**: `Vytvoř infra/traefik/ adresář s docker-compose.yml (Traefik 3.x, sítě: traefik-public), traefik.yml (entrypoints http/https, certresolver letsencrypt, accessLog zapnutý), acme.json soubor s chmod 600. Přidej Traefik labels do api a web služeb v docker-compose.yml. Přidej endpoint pro Traefik dashboard pouze na localhost (bez veřejného přístupu).`
- **Manuální kroky (Uživatel)**:
  1. U registrátora domény nastav A záznam: `@` a `api` → `<VPS_IP>`
  2. Na VPS: `mkdir -p /opt/notionapp && cd /opt/notionapp`
  3. Uprav `traefik.yml` – doplň svůj email pro Let's Encrypt
  4. `touch acme.json && chmod 600 acme.json`
  5. `docker compose -f infra/traefik/docker-compose.yml up -d`
- **Technologie/nástroje**: Traefik 3.x, Let's Encrypt

---

### 0.7 GitHub Secrets konfigurace

> ⚠️ **Aktualizováno pro model A** – viz tabulka v „Skutečný stav infrastruktury" výše.
> Hotové: `VPS_HOST`, `VPS_USER=root`, `VPS_SSH_KEY`, `JWT_SECRET`, `NOTION_ENCRYPTION_KEY`,
> `DOMAIN`. `GHCR_TOKEN` se **nepoužívá**. `VPS_USER` je `root` (ne `deploy`).
> U modelu A patří aplikační tajemství (JWT, NOTION_ENCRYPTION_KEY, GOOGLE_*) do serverového
> `.env`, ne do GH Secrets. **Zbývá jen vytvořit Google OAuth client** (TODO výše).

- **Popis**: Nastavení všech potřebných GitHub Secrets pro CI/CD pipeline.
- **Kdo**: `[Uživatel]` (manuální kroky)
- **Vstup**: VPS SSH klíč, Google OAuth credentials, doména
- **Výstup**: Všechny secrets nastaveny v GitHub repozitáři
- **Testy/Revize**: CI/CD workflow proběhne bez chyb při příštím push
- **Manuální kroky**:
  1. Jdi na GitHub → Settings → Secrets and variables → Actions → New repository secret
  2. Přidej tyto secrets (jméno = hodnota):
     - `VPS_HOST` = IP adresa VPS
     - `VPS_USER` = `deploy`
     - `VPS_SSH_KEY` = obsah `~/.ssh/github_deploy` (private key)
     - `GOOGLE_CLIENT_ID` = z Google Cloud Console (viz 1.3)
     - `GOOGLE_CLIENT_SECRET` = z Google Cloud Console
     - `JWT_SECRET` = náhodný string: `openssl rand -base64 64`
     - `NOTION_ENCRYPTION_KEY` = náhodný 32B klíč: `openssl rand -hex 32`
     - `GHCR_TOKEN` = GitHub Personal Access Token s `write:packages`
     - `DOMAIN` = tvoje doména (např. `notionapp.example.com`)

---

## FÁZE 1: Backend API (Fastify + TypeScript)

### 1.1 Projekt setup, ESLint, Prettier, Husky

- **Popis**: Inicializace `packages/api` s Fastify 5, TypeScript, vývojovými nástroji, Husky pre-commit hooky a validací environment variables při startu.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo z 0.2
- **Výstup**: Funkční Fastify server na :3000, ESLint + Prettier integrace, Husky pre-commit lint, validace env vars
- **Testy/Revize**: `npm run dev` spustí server; bez potřebných env vars server odmítne nastartovat s popisnou chybou; `npm run lint` projde bez chyb
- **Claude Code zadání**: `V packages/api nastav Fastify 5 projekt: package.json (fastify@5, @fastify/cors, @fastify/cookie, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui, fastify-plugin, zod, better-sqlite3, pino), tsconfig.json extendující base, src/env.ts (Zod validace všech env proměnných při startu – process.exit(1) při chybějící proměnné), src/server.ts (Fastify instance, globální setErrorHandler vracející sanitizované JSON chyby bez stack trace v produkci, Pino s redact: ["req.headers.authorization", "body.token", "body.integration_token"], registrace pluginů), src/index.ts. Přidej tsx pro dev, tsup pro build.`
- **Technologie/nástroje**: Fastify 5.x, tsx, tsup, Husky 9.x, lint-staged, Zod (env validace)

---

### 1.2 SQLite schema (users, sessions, notion_configs) + migrace

- **Popis**: Definice databázového schématu pouze pro auth data (úkoly jsou v Notioně). Migrace jsou číslované SQL soubory s `schema_migrations` tabulkou pro bezpečné schema změny v produkci.
- **Kdo**: `[Claude]`
- **Vstup**: Backend projekt z 1.1
- **Výstup**: `src/db/index.ts`, `src/db/migrations/001_init.sql`, migrace runner, inicializační skript
- **Testy/Revize**: `npm run db:migrate` vytvoří SQLite soubor se správnými tabulkami; spuštění znovu je idempotentní
- **Claude Code zadání**: `Vytvoř src/db/index.ts (inicializace better-sqlite3, WAL mode, foreign keys ON, připojení k souboru z DATABASE_PATH env). Vytvoř src/db/migrations/ runner: čte všechny *.sql soubory seřazené dle čísla, ukládá provedené migrace do schema_migrations tabulky, přeskočí již provedené. Migrace 001_init.sql: tabulky users (id TEXT PK, google_id TEXT UNIQUE, email TEXT UNIQUE, name TEXT, avatar_url TEXT, created_at INTEGER), sessions (id TEXT PK, user_id TEXT FK→users ON DELETE CASCADE, token_hash TEXT UNIQUE, expires_at INTEGER, last_seen_at INTEGER, created_at INTEGER), notion_configs (id TEXT PK, user_id TEXT UNIQUE FK→users ON DELETE CASCADE, integration_token_encrypted TEXT, token_iv TEXT, token_auth_tag TEXT, key_version INTEGER DEFAULT 1, database_id TEXT, validated_at INTEGER, created_at INTEGER, updated_at INTEGER). Přidej indexy: idx_sessions_token_hash, idx_sessions_user_id, idx_sessions_expires_at (pro cleanup), idx_users_google_id. Přidej AES-256-GCM šifrování Notion tokenu přes Node.js crypto: pro každý zápis generuj náhodný 12B IV (NIKDY neopakovat klíč+IV), ukládej IV i 16B auth tag zvlášť, podporuj key_version pro budoucí rotaci klíče. Klíč načti z NOTION_ENCRYPTION_KEY (hex 32B), validuj délku při startu. Přidej periodický cleanup expirovaných sessions (DELETE WHERE expires_at < now) – volaný při startu a node-cron každou hodinu.`
- **Technologie/nástroje**: better-sqlite3 9.x, Node.js crypto (built-in), node-cron (session cleanup)

---

### 1.3 Google OAuth 2.0 flow + session management

- **Popis**: Implementace OAuth 2.0 flow s JWT v HTTPOnly cookie. Sessions jsou uloženy v SQLite (umožňuje logout a invalidaci konkrétní session bez změny JWT_SECRET). Refresh probíhá automaticky prodloužením session při aktivitě.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Google Cloud Console setup (manuální), SQLite schema z 1.2
- **Výstup**: Funkční `/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/logout` endpointy
- **Testy/Revize**: Přihlášení přes Google funguje; cookie se nastaví; `/auth/me` vrátí uživatele; logout smaže session ze SQLite
- **Claude Code zadání**: `Implementuj src/plugins/auth.ts: Google OAuth 2.0 Authorization Code flow s PKCE (code_challenge S256) a CSRF state parametrem – state i code_verifier ulož do krátkodobé HTTPOnly cookie (TTL 10 min) a v callbacku striktně ověř shodu (bez google-auth-library – standardní OAuth2 s fetch pro token exchange a Google Identity API pro userinfo na https://www.googleapis.com/oauth2/v3/userinfo). Vygeneruj náhodný opaque session token (32B), do SQLite ulož jen jeho SHA-256 hash (token_hash), do JWT (jose) vlož session id + jti, expirace 7 dní (absolute) + idle timeout 30 dní s prodloužením session při aktivitě. HTTPOnly Secure SameSite=Lax cookie (Lax kvůli OAuth redirectu; Strict by zablokoval cookie při návratu z Google). Cookie scope na vlastní doménu, Path=/. Middleware: ověř JWT (alg whitelist ES256/HS256, NE 'none') + existenci a expiraci session v SQLite (umožňuje okamžitou invalidaci). Logout: smaže session z DB, clearCookie. Endpoint POST /auth/mobile pro iOS: přijme Google id_token, POVINNĚ ověř podpis proti Google JWKS (https://www.googleapis.com/oauth2/v3/certs, cache klíčů), zkontroluj iss (accounts.google.com), aud (== GOOGLE_CLIENT_ID resp. iOS client id), exp, email_verified; teprve pak vystav session cookie. Přidej rotaci session id při (re)loginu.`
- **Technologie/nástroje**: jose (JWT + JWKS verifikace), @fastify/cookie, Google Identity API (userinfo + certs)
- **Manuální kroky (Google Cloud Console)**:
  1. Jdi na https://console.cloud.google.com → New Project: `NotionTodoApp`
  2. APIs & Services → Enable APIs → vyhledej **"Google Identity"** a **"People API"** → Enable (pozor: Google+ API je deprecated a zrušené)
  3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
  4. Application type: Web application, Name: `NotionTodoApp`
  5. Authorized redirect URIs: `http://localhost:3000/auth/google/callback` a `https://api.yourdomain.com/auth/google/callback`
  6. Zkopíruj Client ID a Client Secret → ulož do GitHub Secrets (viz 0.7)

---

### 1.4 Notion integration service + Setup wizard endpoint

- **Popis**: Notion API klient pro čtení a zápis úkolů. Validace databáze ověřuje existenci povinných sloupců se správnými typy. **Podúkoly jsou implementovány jako nativní Notion Sub-items** (child stránky ve stejné databázi s parent_id vazbou) – jsou viditelné jako podúkoly přímo v Notionu.
- **Kdo**: `[Claude]`
- **Vstup**: Auth middleware z 1.3
- **Výstup**: `src/services/notion.ts`, `POST /api/setup/validate`, `POST /api/setup/save`
- **Testy/Revize**: Validace vrátí chybu pro neexistující sloupce; úspěch pro správnou DB; SSRF ochrana: URL pro Notion API je hardcoded (ne z user inputu)
- **Claude Code zadání**: `Vytvoř src/services/notion.ts s NotionService třídou: metody validateDatabase(token, dbId) která ověří existenci a typy sloupců: Name=title, Status=select (options: Todo/In Progress/Review/Done), Tags=multi_select, Due=date, Timeline=date, Owner=people, Description=rich_text, DependsOn=relation (self-referencing). Podúkoly jsou nativní Sub-items – dotazuj přes filter {property: "parent_page_id"} nebo pomocí blocks API. getTasks() vrátí flat list + parent_id pro hierarchii (kompletní stránkování přes start_cursor/has_more, ne jen prvních 100), createTask(), updateTask(), deleteTask(), createSubtask(parentId). Validuj database_id i parent_id jako UUID formát (regex) PŘED použitím v API cestě (ochrana proti path/SSRF injection). Implementuj sdílenou request queue (p-queue concurrency dle rate limitu, ne per-request) s rate limiting ~3 req/s (Notion API limit) a exponential backoff s respektem k Retry-After hlavičce u 429. Reuse HTTP spojení (undici keep-alive agent). Všechna volání mají timeout 10s + AbortController. Přidej server-side per-user cache vrstvu (in-memory LRU, TTL ~20s) pro getTasks – mutace jsou write-through (po úspěšném zápisu invaliduj/aktualizuj cache), čímž se drasticky sníží počet volání Notion při 30s pollingu více klientů. Endpoint POST /api/setup: přijme token a dbId, zavolá validateDatabase, při úspěchu zašifruje a uloží do notion_configs. Přidej volitelný POST /api/setup/create-database: přes Notion API vytvoř novou databázi se správným schématem (8 sloupců) jako rodiče zvolené stránky – sníží friction onboarding.`
- **Technologie/nástroje**: @notionhq/client 2.x, p-queue pro request throttling, lru-cache, undici (keep-alive)

---

### 1.5 Tasks CRUD API (s Zod validací + OpenAPI dokumentace)

- **Popis**: Kompletní CRUD endpointy pro úkoly s Zod validací vstupů a výstupů. Swagger UI dostupné na `/docs` pro snadné testování a dokumentaci.
- **Kdo**: `[Claude]`
- **Vstup**: NotionService z 1.4
- **Výstup**: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `POST /api/tasks/:id/subtasks`, Zod schémata v `packages/shared`, Swagger UI na `/docs`
- **Testy/Revize**: Všechny endpointy vrátí validovaná data; neplatné vstupy vrátí 400 s popisem chyby; `/docs` zobrazí OpenAPI dokumentaci
- **Claude Code zadání**: `V packages/shared/src/schemas.ts vytvoř Zod schémata pro Task (name: string, status: enum(Todo/InProgress/Review/Done), tags: string[], dueDate: date optional, timeline: {start: date, end: date} optional, ownerIds: string[], description: string optional, dependsOnIds: string[], parentId: string optional). V packages/api vytvoř src/routes/tasks.ts: GET /api/tasks (query params: search, tags, status, parentId), POST /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id, DELETE /api/tasks/:id, POST /api/tasks/:id/subtasks. Každý endpoint: auth middleware + Zod validace + @fastify/swagger JSON schema. Přidej /api/tasks/:id/subtasks GET endpoint vracející child tasks.`
- **Technologie/nástroje**: Zod 3.x, packages/shared workspace, @fastify/swagger, @fastify/swagger-ui

---

### 1.6 Rate limiting middleware

- **Popis**: Rate limiting dvouúrovňový: 120 požadavků za 60 sekund per IP pro `/auth/*`, plus 300 požadavků za 60 sekund per user ID pro `/api/*` (autentizované endpointy – chrání i uživatele za NAT/VPN sdílející IP).
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1, auth middleware z 1.3
- **Výstup**: Rate limiting aktivní na všech routách
- **Testy/Revize**: Po překročení limitu vrátí 429 s Retry-After hlavičkou
- **Claude Code zadání**: `Nakonfiguruj @fastify/rate-limit: pro /auth/* keyGenerator podle IP (respektuj X-Forwarded-For za Traefikem, trustProxy s přesným počtem hopů – ber jen klientskou IP, ne spoofovatelnou), pro /api/* keyGenerator podle req.user.id (po auth middleware), max 300 req/60s. POZOR na pořadí: přidej i hrubý IP-based pre-auth limit, který běží PŘED autentizací (chrání /api/* proti záplavě neautentizovaných požadavků dřív, než se vyhodnotí session). Custom errorMessage v JSON s retryAfter. Přidej RateLimit-* a Retry-After headers. Nastav globální Fastify limity: bodyLimit (např. 256KB), connectionTimeout, max délku URL/query, aby se předešlo DoS přes velké payloady. (Pozn.: in-memory store je OK pro 1 instanci; při horizontálním škálování přepni store na Redis.)`
- **Technologie/nástroje**: @fastify/rate-limit (in-memory; Redis při škálování)

---

### 1.7 CORS + security headers

- **Popis**: CORS omezení pouze na povolené originy, Helmet security headers, CSP politika.
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1
- **Výstup**: CORS a security headers aktivní
- **Testy/Revize**: Request z nepovolené domény vrátí CORS chybu; headers obsahují CSP, HSTS, X-Frame-Options
- **Claude Code zadání**: `Nakonfiguruj @fastify/cors: origin povoleno pouze pro FRONTEND_URL env (v dev http://localhost:5173), credentials: true, methods whitelist, NE reflektovat libovolný origin. Nakonfiguruj @fastify/helmet (CSP: default-src 'self', script-src 'self', style-src 'self', object-src 'none', frame-ancestors 'none', base-uri 'self'; vyhni se 'unsafe-inline' – Tailwind v4 generuje statické CSS). HSTS pro produkci (max-age=63072000; includeSubDomains; preload). Vypni X-Powered-By, nastav Referrer-Policy a Permissions-Policy. SEPARÁTNÍ CSP nasaď i pro web (nginx security headers v 7.2): connect-src musí povolit API doménu, jinak fetch selže; nastav stejné frame-ancestors/object-src. Ověř výsledek přes securityheaders.com a Mozilla Observatory.`
- **Technologie/nástroje**: @fastify/cors, @fastify/helmet, nginx security headers (web)

---

### 1.8 GDPR, audit log a observabilita

- **Popis**: Endpointy pro správu osobních dat (právo na výmaz a export dle GDPR), bezpečnostní audit log a základní observabilita (strukturované logy, metriky, graceful shutdown). Doplňuje dříve chybějící „provozní" a „compliance" vrstvu.
- **Kdo**: `[Claude]`
- **Vstup**: Auth + DB z 1.2–1.3
- **Výstup**: `DELETE /api/account`, `GET /api/account/export`, audit log tabulka, `/health` + `/metrics`, graceful shutdown
- **Testy/Revize**: Výmaz účtu smaže users/sessions/notion_configs/device_tokens (CASCADE); export vrátí JSON se všemi daty uživatele; audit log zaznamená login/logout/setup/delete
- **Claude Code zadání**: `Přidej DELETE /api/account (smaže uživatele a díky ON DELETE CASCADE i sessions, notion_configs, device_tokens; zruší cookie) a GET /api/account/export (JSON se všemi osobními daty – profil, configy bez plaintext tokenu). Přidej tabulku audit_log (id, user_id, event, ip, user_agent, created_at) do migrace 002 a zaznamenávej bezpečnostní události (login, logout, setup změna, account delete, neúspěšné ověření). Minimalizuj PII v provozních logách (Pino redact emailů). Přidej /health (status, uptime, db check, version) a /metrics (Prometheus přes fastify-metrics – volitelné, chráněné). Implementuj graceful shutdown (SIGTERM → dokonči requesty, zavři DB, vyprázdni Notion frontu).`
- **Technologie/nástroje**: Fastify hooks, fastify-metrics (volitelné), node:crypto

---

## FÁZE 2: Testy backendu (Test-first přístup)

### 2.1 Unit testy (Vitest) – services, validators

- **Popis**: Unit testy pro NotionService, Zod validátory, šifrovací funkce a auth helpery.
- **Kdo**: `[Claude]`
- **Vstup**: Backend kód z Fáze 1
- **Výstup**: `packages/api/src/**/*.test.ts`, pokrytí >80%
- **Testy/Revize**: `npm run test` projde; coverage report >80%
- **Claude Code zadání**: `Vytvoř unit testy (Vitest) pro: NotionService.validateDatabase (mock @notionhq/client – testuj správné i nesprávné sloupce), NotionService rate limiting (ověř že queue throttluje na 3 req/s), Zod schémata (platné/neplatné vstupy pro Task), šifrování/dešifrování Notion tokenu (round-trip test), JWT generování a validaci, session invalidace. Použij vi.mock pro external závislosti. Nastav vitest.config.ts s coverage reportem (provider: v8, threshold: 80%).`
- **Technologie/nástroje**: Vitest 1.x, @vitest/coverage-v8

---

### 2.2 Integration testy – API endpoints

- **Popis**: Integrace testy spouštějící skutečný Fastify server s testovací in-memory SQLite DB a mockovaným Notion API.
- **Kdo**: `[Claude]`
- **Vstup**: Unit testy z 2.1
- **Výstup**: Testy pro všechny API endpointy včetně auth flow
- **Testy/Revize**: `npm run test:integration` projde se skutečnými HTTP požadavky
- **Claude Code zadání**: `Vytvoř integration testy: auth flow (mock Google Identity API odpovědi), task CRUD operace (mock @notionhq/client), rate limiting (ověř 429 po překročení per-user limitu), setup wizard validace (mock Notion validateDatabase). Použij fastify.inject() pro HTTP testy. Každý test: čistá in-memory SQLite (`:memory:`), reset mock stavu. Testuj také error stavy: Notion API timeout, neplatný token, chybějící session.`
- **Technologie/nástroje**: Vitest, fastify.inject()

---

### 2.3 E2E API testy

- **Popis**: End-to-end testy skutečného běžícího serveru simulující kompletní uživatelský flow.
- **Kdo**: `[Claude]`
- **Vstup**: Integration testy z 2.2
- **Výstup**: E2E test suite pro kritické cesty
- **Testy/Revize**: `npm run test:e2e` projde proti lokálně běžícímu serveru
- **Claude Code zadání**: `Vytvoř E2E testy s undici HTTP klientem: kompletní flow přihlášení (mock OAuth callback) → setup wizard (mock Notion validate) → vytvoření úkolu → editace → vytvoření podúkolu → smazání. Nastav testovací environment s proměnnými, separátní testovací SQLite soubor s cleanup po testech.`
- **Technologie/nástroje**: undici, Vitest

---

## FÁZE 3: Frontend Web (React + Vite)

### 3.1 Projekt setup, Tailwind CSS, Shadcn/ui

- **Popis**: Inicializace React + Vite + TypeScript projektu s Tailwind CSS a Shadcn/ui komponentami.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura z 0.2
- **Výstup**: Fungující Vite dev server s Tailwind, Shadcn/ui komponenty dostupné
- **Testy/Revize**: `npm run dev` zobrazí landing page; Shadcn Button komponenta se renderuje; TypeScript kompilace bez chyb
- **Claude Code zadání**: `V packages/web inicializuj Vite React TypeScript projekt. Nastav Tailwind CSS v4 (ověř kompatibilitu s aktuální verzí shadcn/ui – použij shadcn CLI s --legacy-peer-deps pokud potřeba). Přidej shadcn/ui (init s New York style, zinc barvy). Nakonfiguruj path aliasy (@/ → src/). Přidej základní layout: App.tsx s React Router (react-router-dom v7), stránky: LoginPage, SetupPage, DashboardPage. Přidej Error Boundary komponentu pro zachycení runtime chyb. Přidej Poppins font přes Google Fonts. Nastav Vite proxy pro /api/* → http://localhost:3000 v dev módu.`
- **Technologie/nástroje**: Vite 6.x, React 19, Tailwind CSS 4.x, Shadcn/ui, React Router 7.x

---

### 3.2 Auth flow (Google OAuth redirect, session management)

- **Popis**: Frontend auth: přesměrování na backend OAuth, zpracování callbacku, persitence session, protected routes.
- **Kdo**: `[Claude]`
- **Vstup**: Backend auth endpointy z 1.3, Vite setup z 3.1
- **Výstup**: Funkční přihlášení přes Google, protected routes, auto-logout při expiraci
- **Testy/Revize**: Nepřihlášený uživatel přesměrován na login; přihlášený vidí dashboard; 401 odpověď automaticky odhlásí uživatele
- **Claude Code zadání**: `Vytvoř src/hooks/useAuth.ts (React Query dotaz na /auth/me, logout funkce volající /auth/logout), src/components/ProtectedRoute.tsx (redirect na /login pokud není user), LoginPage s Google přihlášení tlačítkem (přesměruje na backend /auth/google). Nastav React Query globální onError handler: při 401 odpovědi z libovolného endpointu invaliduj auth session a přesměruj na login. Ošetři loading state se skeleton loaderem.`
- **Technologie/nástroje**: React Query (TanStack Query) 5.x, React Router

---

### 3.3 Setup wizard UI

- **Popis**: Vícekrokový průvodce pro zadání Notion integration tokenu a Database ID s validací a maskováním tokenu.
- **Kdo**: `[Claude]`
- **Vstup**: Auth flow z 3.2
- **Výstup**: SetupPage s 3 kroky: intro, zadání credentials, potvrzení
- **Testy/Revize**: Neplatný token zobrazí chybovou zprávu; platný token zobrazí seznam validovaných sloupců se zelenými/červenými ikonami
- **Claude Code zadání**: `Vytvoř src/pages/SetupPage.tsx: krok 1 (instrukce jak vytvořit Notion integration a sdílet databázi s integrací – s obrázky/screenshoty nebo linky na Notion docs), krok 2 (input pro token s maskováním – zobraz jen prefix "secret_XXXX...", input pro DB ID nebo URL s automatickým parsováním ID z URL), krok 3 (výsledek validace – seznam 8 sloupců se zelenými/červenými ikonami + nápověda jak opravit chybějící). Po úspěchu přesměruj na dashboard. Použij Shadcn/ui Card, Input, Button, Alert, Badge komponenty.`
- **Technologie/nástroje**: Shadcn/ui, React Hook Form, Zod

---

### 3.4 Task store (Zustand) + API hooks (React Query)

- **Popis**: Globální UI stav v Zustand, API hooks s optimistickými aktualizacemi, auto-refresh každých 30s.
- **Kdo**: `[Claude]`
- **Vstup**: CRUD API z 1.5
- **Výstup**: `src/store/taskStore.ts`, `src/hooks/useTasks.ts`, optimistické UI aktualizace
- **Testy/Revize**: Vytvoření úkolu se okamžitě zobrazí (optimistický update); při chybě se rollbackne; hierarchie rodič/podúkol správně zobrazena
- **Claude Code zadání**: `Vytvoř Zustand store pro UI state (activeView: kanban|timeline|calendar, openTaskId, filters: {search, tags, status}). Vytvoř React Query hooks: useTasksQuery (jeden zdroj pravdy – kompletní flat list, refetchInterval 30000 ale refetchIntervalInBackground: false a pauza když je tab skrytý/document.hidden, staleTime 25000, refetchOnWindowFocus: true – šetří volání Notion). Hierarchie a počty podúkolů se počítají z tohoto seznamu (žádné per-card dotazy → žádný N+1); detail modal používá select z téhož cache místo samostatného dotazu. useCreateTask/useUpdateTask/useDeleteTask/useCreateSubtask s optimistickým updatem (onMutate snapshot + temp ID, onError rollback, onSettled invalidate). Řeš konflikt s externími úpravami v Notionu: nepřepisuj čerstvá serverová data zastaralou optimistickou mutací (porovnej last_edited_time), při detekci externí změny zobraz nenásilný indikátor „aktualizováno". Vytvoř src/api/client.ts (fetch wrapper s credentials: "include", typové chyby, automatický logout při 401, retry s backoff jen pro idempotentní GET).`
- **Technologie/nástroje**: Zustand 5.x, TanStack Query 5.x

---

### 3.5 Kanban board view (dnd-kit)

- **Popis**: Kanban board s sloupci pro každý status (Todo, In Progress, Review, Done), drag & drop přesun mezi sloupci. Zobrazuje pouze top-level úkoly (ne podúkoly).
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/KanbanView.tsx`, funkční drag & drop s optimistickým přesunem
- **Testy/Revize**: Přetažení karty aktualizuje status; podúkoly se zobrazí jako badge s počtem na kartě rodiče
- **Claude Code zadání**: `Vytvoř KanbanView komponentu: 4 sloupce (Todo/In Progress/Review/Done) s @dnd-kit/core a @dnd-kit/sortable. Každá karta (TaskCard) zobrazuje: název, tagy (barevné badges), due date (červená pokud po termínu), avatar ownera, počet podúkolů jako badge (kliknutí otevře detail). Filtruj jen tasks bez parentId pro hlavní view. Drop target zvýrazní sloupec. Po dropu zavolej useUpdateTask s novým statusem. Sloupce mají počítadlo úkolů v headeru. Přidej empty state s CTA tlačítkem "Vytvořit první úkol". Výkon: TaskCard zabal do React.memo (stabilní props), pro dlouhé sloupce (>50 karet) použij virtualizaci (@tanstack/react-virtual). Přístupnost D&D: zapni @dnd-kit KeyboardSensor + screen-reader announcements (announcements/aria-live), respektuj prefers-reduced-motion. Po dropu okamžitý optimistický přesun, při chybě rollback + toast.`
- **Technologie/nástroje**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @tanstack/react-virtual

---

### 3.6 Timeline/Gantt view

- **Popis**: Gantt chart s horizontální časovou osou, přetahovatelné a roztahovatelné úkoly, kreslení závislostí.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/TimelineView.tsx` s plně funkčním Gantt chartem
- **Testy/Revize**: Úkoly se zobrazují ve správné časové pozici; drag posune timeline; resize změní délku
- **Claude Code zadání**: `Vytvoř TimelineView – zvaž použití knihovny gantt-task-react nebo @bryntum/gantt (volná verze) jako základ, případně vlastní SVG implementace. Horizontální osa (dny/týdny, zoom přepínatelný tlačítky), řádky pro každý úkol, barevné bary odpovídající Timeline datu. Implementuj drag pro přesun (změní start+end datum), resize handle vpravo pro změnu end data. Závislosti (dependsOn) nakresli jako šipky mezi bary. Přidej dnes zvýrazněnou vertikální linku. Lazy load přes React.lazy + Suspense (Timeline je těžká komponenta).`
- **Technologie/nástroje**: React + SVG, React.lazy/Suspense, date-fns

---

### 3.7 Calendar view

- **Popis**: Měsíční kalendářní zobrazení s kliknutím pro vytvoření úkolu a drag & drop pro přesunutí na jiný den.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/CalendarView.tsx`
- **Testy/Revize**: Úkoly se zobrazují na správných dnech; klik na prázdný den otevře modal s předvyplněným datem
- **Claude Code zadání**: `Vytvoř CalendarView: mřížka 7×6 dnů, navigace měsíc vpřed/vzad, úkoly zobrazeny jako barevné piluky na příslušných dnech (podle due date). Klik na den → otevře CreateTaskModal s předvyplněným due date. Drag úkolu na jiný den → optimistický update due date. Dnes zvýrazněn kruhem. Lazy load přes React.lazy + Suspense.`
- **Technologie/nástroje**: @dnd-kit/core, date-fns, React.lazy/Suspense

---

### 3.8 Task detail modal (podúkoly, závislosti)

- **Popis**: Modální okno pro zobrazení a editaci kompletního detailu úkolu včetně podúkolů (Notion Sub-items) a závislostí.
- **Kdo**: `[Claude]`
- **Vstup**: Task store, Shadcn/ui z 3.1
- **Výstup**: `src/components/TaskDetailModal.tsx`
- **Testy/Revize**: Všechna pole editovatelná; podúkoly lze přidat/zaškrtnout (změní status na Done)/smazat; závislosti zobrazeny jako tagy s možností odebrání
- **Claude Code zadání**: `Vytvoř TaskDetailModal (Shadcn Dialog): sekce pro každé pole (název inline edit, status Select, tags MultiSelect, due date DatePicker, owner zobrazení avatarů, description Textarea). Subtasks sekce: načti child tasks přes useTasksQuery({parentId}), zobraz jako checklist – zaškrtnutí změní status na Done/Todo, tlačítko "Přidat podúkol" vytvoří nový task s parentId. DependsOn: Combobox pro vyhledání a přidání dalších top-level úkolů jako závislost. Optimistické ukládání při každé změně (debounce 500ms). Zobraz breadcrumb pokud je task sám podúkolem.`
- **Technologie/nástroje**: Shadcn/ui Dialog, Select, Calendar komponenty, date-fns

---

### 3.9 Search + filter UI

- **Popis**: Fulltextové vyhledávání podle názvu úkolu a filtrování podle tagů a statusu.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/components/SearchBar.tsx`, `src/components/TagFilter.tsx`
- **Testy/Revize**: Zadání textu filtruje viditelné úkoly; výběr tagu zobrazí jen úkoly s tímto tagem; reset filtrů vrátí vše
- **Claude Code zadání**: `Vytvoř SearchBar komponentu: input s debounce 300ms, ukládá search query do Zustand store. TagFilter: zobrazí všechny unikátní tagy z úkolů jako kliknutelné badges (toggle aktivní/neaktivní), ukládá aktivní tagy do store. Filtrace probíhá client-side v Zustand selektoru (search filtruje name + description, tagy i status jsou AND podmínky). Přidej tlačítko "Reset filtrů" viditelné jen pokud jsou aktivní filtry.`
- **Technologie/nástroje**: Zustand selektory, use-debounce

---

### 3.10 Keyboard shortcuts

- **Popis**: Klávesové zkratky: 1/2/3 pro přepínání pohledů, N pro nový úkol, Escape pro zavření modálů, ? pro nápovědu.
- **Kdo**: `[Claude]`
- **Vstup**: Veškerý frontend z 3.1–3.9
- **Výstup**: `src/hooks/useKeyboardShortcuts.ts`
- **Testy/Revize**: Stisk 1 přepne na Kanban; N otevře modal pro nový úkol; Escape zavře otevřený modal
- **Claude Code zadání**: `Vytvoř useKeyboardShortcuts hook s useEffect na window keydown event: 1/2/3 přepínají activeView (kanban/timeline/calendar), N otevře CreateTaskModal, Escape nastaví openTaskId na null. Ignoruj zkratky pokud je focus v input/textarea/[contenteditable]. Přidej KeyboardShortcutsHelp komponentu (Shadcn Dialog) otevíranou klávesou ?, zobrazující tabulku všech zkratek.`
- **Technologie/nástroje**: React hooks, Zustand

---

### 3.11 Globální UX systémy: notifikace, undo, offline/error feedback

- **Popis**: Sjednocená vrstva zpětné vazby pro celou appku – toast notifikace pro úspěch/chybu, undo u destruktivních akcí, banner při výpadku API/offline, globální loading. Dosud chyběla; bez ní působí optimistické updaty „tiše" a chyby nejsou srozumitelné.
- **Kdo**: `[Claude]`
- **Vstup**: API hooks z 3.4
- **Výstup**: `src/components/Toaster`, `src/components/OfflineBanner`, undo pattern u mazání
- **Testy/Revize**: Úspěšná akce zobrazí toast; mazání nabídne „Vrátit zpět" (5s) než se potvrdí; výpadek API zobrazí banner s retry; dvojklik na submit neodešle 2×
- **Claude Code zadání**: `Přidej toast systém (sonner) napojený na React Query mutace: success/error toasty s lokalizovanými, akčními zprávami (ne raw error). U useDeleteTask implementuj optimistické odstranění s undo (toast s tlačítkem „Vrátit zpět", potvrzení mazání až po vypršení / zrušení). Přidej OfflineBanner: detekuj navigator.onLine + selhání fetch (network error) a 5xx, zobraz nenásilný banner s tlačítkem „Zkusit znovu". Tlačítka odesílající mutace blokuj během pending (zamezit dvojodeslání). Volitelně command palette (cmdk) pro rychlé akce/přepínání pohledů.`
- **Technologie/nástroje**: sonner, TanStack Query, cmdk (volitelné)

---

### 3.12 Přístupnost (a11y), motivy a lokalizace času/jazyka

- **Popis**: Splnění WCAG 2.1 AA, focus management v modálech, dark mode s persistencí, konzistentní práce s časovými pásmy a příprava na lokalizaci. Sjednocuje a rozšiřuje a11y/UX požadavky roztroušené v 8.3.
- **Kdo**: `[Claude]`
- **Vstup**: Komponenty z 3.1–3.10
- **Výstup**: a11y utilities, theme provider, datum/čas helpery
- **Testy/Revize**: Modály mají focus trap a vrací focus; vše ovladatelné klávesnicí; kontrast statusových barev ≥ 4.5:1; dark/light dle systému + přepínač s persistencí; termíny se zobrazují konzistentně bez chyb o ±1 den
- **Claude Code zadání**: `Zajisti a11y: focus trap + návrat focusu u Dialogů (Shadcn/Radix to umí – ověř), viditelný focus ring, aria-label na ikon-only tlačítkách, role/aria u kanban sloupců a karet, aria-live pro toasty a stav D&D, respektuj prefers-reduced-motion. Ověř barevný kontrast statusů (≥4.5:1). Theme: ThemeProvider s light/dark/system, persistence do localStorage, respekt prefers-color-scheme, Tailwind dark: třídy. Čas: jednotně ukládej/posílej ISO 8601, zobrazuj v lokálním TZ uživatele (date-fns-tz), pozor na date-only (Due) vs datetime – žádné posuny o den kvůli UTC. Připrav i18n strukturu (i18next nebo jen centralizovaný slovník) i kdyby výchozí jazyk byl jen čeština. Mobilní web: definuj breakpointy – pokud je web desktop-first, explicitně to uveď a zajisti aspoň použitelný layout na tabletu (kanban horizontální scroll).`
- **Technologie/nástroje**: Radix/Shadcn focus management, date-fns-tz, i18next (příprava), Tailwind dark mode

---

## FÁZE 4: Testy frontendu

### 4.1 Unit testy komponent (Vitest + Testing Library)

- **Popis**: Unit testy React komponent s mockováním API volání.
- **Kdo**: `[Claude]`
- **Vstup**: Frontend kód z Fáze 3
- **Výstup**: Testy pro klíčové komponenty, pokrytí >70%
- **Testy/Revize**: `npm run test` projde; komponenty renderují správně pro různé stavy (loading, empty, error, data)
- **Claude Code zadání**: `Vytvoř testy (Vitest + @testing-library/react): TaskCard (renderuje název, status, tagy, badge podúkolů), KanbanView (správný počet sloupců, empty state), SearchBar (debounce filtrování), TaskDetailModal (validace formuláře, zobrazení podúkolů). Mockuj React Query pomocí msw (Mock Service Worker) pro API odpovědi. Testuj error boundary zobrazení při pádu komponenty.`
- **Technologie/nástroje**: Vitest, @testing-library/react, msw 2.x

---

### 4.2 Playwright E2E testy

- **Popis**: Klikací E2E testy v Chromium prohlížeči simulující reálné uživatelské scénáře.
- **Kdo**: `[Claude]`
- **Vstup**: Běžící frontend + backend (lokálně nebo CI)
- **Výstup**: `packages/web/e2e/*.spec.ts`
- **Testy/Revize**: `npm run test:e2e` projde; screenshoty při chybě uloženy
- **Claude Code zadání**: `Vytvoř Playwright testy: login flow (mock OAuth), setup wizard (zadání credentials, zobrazení validace), vytvoření úkolu v Kanban view, přesun mezi sloupci drag&drop (pomocí page.dragAndDrop), otevření detailu úkolu a přidání podúkolu, keyboard shortcuts (stisk 1/2/3). Nastav playwright.config.ts s baseURL, screenshots on failure, video recording.`
- **Technologie/nástroje**: Playwright 1.x

---

### 4.3 Visual regression testy

- **Popis**: Screenshot testy pro zachycení nechtěných vizuálních změn v UI.
- **Kdo**: `[Claude]`
- **Vstup**: E2E testy z 4.2
- **Výstup**: Baseline screenshots, automatické porovnání v CI
- **Testy/Revize**: Při změně UI komponenty test selže a zobrazí diff screenshot
- **Claude Code zadání**: `Přidej Playwright visual regression testy pomocí expect(page).toHaveScreenshot(): snímky pro KanbanView (prázdný stav, s úkoly), TaskDetailModal, CalendarView. Nastav threshold 0.2% pro pixel diff (vyšší tolerance kvůli font rendering rozdílům mezi OS). Přidej --update-snapshots flag do npm skriptu. V CI spouštěj na linux/chromium pro konzistentní výsledky.`
- **Technologie/nástroje**: Playwright toHaveScreenshot()

---

### 4.4 Accessibility, kontraktní a regresní testy

- **Popis**: Automatizované a11y testy, kontraktní testy proti Notion API a regresní brány (bundle size, výkon) v CI – uzavírají mezery v testovací strategii.
- **Kdo**: `[Claude]`
- **Vstup**: Testy z 4.1–4.3, UX z 3.11–3.12
- **Výstup**: axe testy, Notion contract testy, CI gates
- **Testy/Revize**: axe nehlásí kritické porušení na klíčových stránkách; kontraktní test selže při změně tvaru Notion odpovědi; PR selže při překročení bundle rozpočtu
- **Claude Code zadání**: `Přidej a11y testy: @axe-core/playwright na LoginPage, SetupPage, DashboardPage (Kanban) a TaskDetailModal – fail na kritických/serious porušeních. Kontraktní testy NotionService proti uloženým fixturám (zachytí mapping regrese) + volitelný opt-in „live" smoke test proti reálnému Notion API (gated env var, mimo běžné CI) pro včasné odhalení breaking changes. Přidej do CI brány: size-limit (bundle), volitelně Lighthouse CI budget. Zaveď test data factory pro snížení duplicit v testech. Pro flaky D&D E2E použij stabilní data-testid a retries. Volitelně Stryker mutation testing pro kritický kód (crypto, auth).`
- **Technologie/nástroje**: @axe-core/playwright, msw, size-limit, Stryker (volitelné)

---

## FÁZE 5: iOS (SwiftUI)

### 5.1 Xcode projekt setup, architektura (MVVM)

- **Popis**: Inicializace Xcode projektu s MVVM architekturou, targets pro app a testy. Xcode projekt je v `packages/ios/` jako součást monorepa, ale buildí se výhradně lokálně v Xcode (ne v Dockeru).
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Mac s Xcode 15+
- **Výstup**: Xcode projekt v `packages/ios/`, MVVM folder struktura, .gitignore pro Xcode artefakty
- **Testy/Revize**: Build a spuštění na iOS Simulator (iPhone 15, iOS 17)
- **Claude Code zadání**: `Vytvoř packages/ios/ se strukturou: Models/, ViewModels/, Views/, Services/, Components/. Přidej základní App.swift, ContentView.swift, AppRouter pro navigaci. Nastav SwiftLint konfiguraci. Uprav kořenový .gitignore: přidej *.xcuserstate, xcuserdata/, DerivedData/, *.ipa.`
- **Manuální kroky**: Otevři Xcode → New Project → iOS App → NotionTodoApp, uložení do packages/ios/
- **Technologie/nástroje**: Xcode 15, Swift 5.9, SwiftUI, SwiftLint

---

### 5.2 Network layer (URLSession + async/await)

- **Popis**: Swift síťová vrstva pro komunikaci s backend API s async/await, error handling a automatickým retry.
- **Kdo**: `[Claude]`
- **Vstup**: Xcode projekt z 5.1
- **Výstup**: `Services/APIClient.swift` s metodami pro všechny endpointy
- **Testy/Revize**: Unit test mockující URLSession vrátí správné modely
- **Claude Code zadání**: `Vytvoř APIClient.swift jako actor s generickou request<T: Decodable> metodou. Ošetři: automatické cookies (HTTPCookieStorage.shared, sdíleno napříč requesty), JSON decode/encode, error typy (APIError enum: unauthorized, notFound, serverError, networkError, timeout). Timeout 10s pro každý request. Endpoint metody: getTasks(parentId:), createTask(), updateTask(), deleteTask(), createSubtask(parentId:), validateNotion(), setupNotion(). Při 401 odpovědi odešli NotificationCenter událost pro logout.`
- **Technologie/nástroje**: URLSession, Swift Concurrency (async/await)

---

### 5.3 Auth flow (Google Sign-In SDK)

- **Popis**: Google přihlášení na iOS s Google Sign-In SDK, uložení session cookie, auto-refresh.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Google Cloud Console iOS client ID (manuální)
- **Výstup**: Funkční přihlášení, session cookie persistována
- **Testy/Revize**: Přihlášení zobrazí Google sheet; po přihlášení se zobrazí dashboard
- **Claude Code zadání**: `Implementuj AuthViewModel s @Published currentUser. Přidej Google Sign-In Swift Package (GoogleSignIn-iOS). Po úspěšném Google Sign-In pošli id_token na backend /auth/mobile endpoint, dostaneš JWT cookie – automaticky uložena v HTTPCookieStorage. Přidej Keychain wrapper pro persistenci cookie hodnoty přes restarty app. Naslouchej NotificationCenter 401 událostem z APIClient pro automatický logout.`
- **Manuální kroky**: V Google Cloud Console přidej iOS OAuth client s Bundle ID tvé aplikace
- **Technologie/nástroje**: GoogleSignIn Swift Package, Security framework (Keychain)

---

### 5.4 Kanban view (SwiftUI)

- **Popis**: Nativní SwiftUI implementace Kanban boardu s velkými tap targets a swipe gesturami.
- **Kdo**: `[Claude]`
- **Vstup**: APIClient z 5.2
- **Výstup**: `Views/KanbanView.swift`
- **Testy/Revize**: Úkoly zobrazeny ve správných sloupcích; swipe pro rychlou změnu statusu; podúkoly jako badge
- **Claude Code zadání**: `Vytvoř KanbanView: horizontální ScrollView se 4 sloupci (LazyHStack), každý sloupec je vertikální seznam (LazyVStack) TaskCard komponent. TaskCard: min výška 80pt, tap otevře detail sheet, badge s počtem podúkolů. Swipe right → "In Progress", swipe left → "Done". Přidej pull-to-refresh (refreshable modifier). Empty state s tlačítkem pro vytvoření prvního úkolu.`
- **Technologie/nástroje**: SwiftUI, ScrollView, gestures

---

### 5.5 Timeline view (SwiftUI Canvas)

- **Popis**: Gantt chart implementovaný pomocí SwiftUI Canvas pro výkonné renderování.
- **Kdo**: `[Claude]`
- **Vstup**: Task modely z 5.2
- **Výstup**: `Views/TimelineView.swift`
- **Testy/Revize**: Úkoly renderovány ve správných časových pozicích; pinch-to-zoom mění měřítko
- **Claude Code zadání**: `Vytvoř TimelineView s Canvas { context, size } renderováním: kreslení řádků, barevných barů pro každý úkol (timeline datum), dnes čára. Přidej DragGesture pro posun view. MagnificationGesture pro zoom (dny/týdny přepínání). Tap na bar otevře detail sheet. Optimalizuj pro 60fps – kresli jen viditelné bary.`
- **Technologie/nástroje**: SwiftUI Canvas, Gestures

---

### 5.6 Calendar view

- **Popis**: Měsíční kalendář v SwiftUI s úkoly zobrazanými na dnech.
- **Kdo**: `[Claude]`
- **Vstup**: Task modely z 5.2
- **Výstup**: `Views/CalendarView.swift`
- **Testy/Revize**: Navigace mezi měsíci; tap na den zobrazí úkoly toho dne
- **Claude Code zadání**: `Vytvoř CalendarView: LazyVGrid 7 sloupců, každý den je DayCell. DayCell zobrazuje číslo dne a barevné tečky pro úkoly (max 3 + "+N"). Tap na den zobrazí sheet se seznamem úkolů. Long press na den otevře CreateTaskSheet s předvyplněným datem. Swipe doleva/doprava pro navigaci měsíce.`
- **Technologie/nástroje**: SwiftUI LazyVGrid, Sheet

---

### 5.7 Task detail + podúkoly

- **Popis**: Native detail view pro úkol s editací všech polí a checklistem podúkolů (Notion Sub-items).
- **Kdo**: `[Claude]`
- **Vstup**: APIClient z 5.2
- **Výstup**: `Views/TaskDetailView.swift`
- **Testy/Revize**: Editace pole uloží změnu; podúkol lze zaškrtnout; závislosti zobrazeny
- **Claude Code zadání**: `Vytvoř TaskDetailView jako Form: TextField pro název, Picker pro status, MultiPicker pro tagy, DatePicker pro due date. Sekce Subtasks: načti child tasks přes APIClient.getTasks(parentId:), List s Toggle pro každý podúkol (toggle změní status Done/Todo), swipe to delete, add button volající createSubtask(parentId:). Přidej debounce ukládání (0.5s po změně). NavigationLink pro závislé úkoly (dependsOn).`
- **Technologie/nástroje**: SwiftUI Form, Combine debounce

---

### 5.8 Push notifikace (APNs)

- **Popis**: Push notifikace pro blížící se termíny úkolů přes Apple Push Notification service.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Apple Developer Account
- **Výstup**: Registrace APNs, backend endpoint pro odeslání notifikace, scheduler
- **Testy/Revize**: Testovací notifikace dorazí na zařízení
- **Claude Code zadání**: `V iOS app: requestAuthorization pro notifikace, registrace pro remote notifications, odeslání device tokenu na backend POST /api/notifications/register. V backendu: přidej tabulku device_tokens (id, user_id, token, platform, created_at) do SQLite migrace 002 (token UNIQUE), odesílání přes APNs HTTP/2 s token-based auth (.p8, JWT ES256) – preferuj udržovanou knihovnu (@parse/node-apn) nebo přímý HTTP/2 klient (původní node-apn je málo udržovaný). node-cron každou hodinu kontroluje tasks z Notion API s due date za 24h a odesílá notifikaci; při 410 odpovědi smaž neplatný device token; dedup přes last_notified_at, aby se neposílala duplicitní notifikace pro stejný task/termín.`
- **Manuální kroky**: V Apple Developer Portal vytvoř APNs klíč (.p8 soubor) a přidej ho jako GitHub Secret `APNS_KEY`
- **Technologie/nástroje**: UserNotifications framework, @parse/node-apn (APNs HTTP/2, token auth), node-cron

---

### 5.9 Offline support (Core Data cache)

- **Popis**: Lokální cache úkolů v Core Data pro offline zobrazení a read-only fungování bez internetu.
- **Kdo**: `[Claude]`
- **Vstup**: Task modely a APIClient z 5.2
- **Výstup**: Core Data model, sync logika při obnovení připojení
- **Testy/Revize**: Vypnutí Wi-Fi → úkoly stále viditelné; zapnutí Wi-Fi → sync s API
- **Claude Code zadání**: `Vytvoř Core Data model TaskEntity s odpovídajícími atributy (stejná pole jako Task model). Vytvoř PersistenceController singleton. Uprav APIClient: po každém úspěšném fetch ulož do Core Data. Při chybě sítě (URLError.notConnectedToInternet) načti z Core Data a zobraz banner "Offline – zobrazena cache". Přidej NWPathMonitor pro detekci obnovení spojení a automatický sync.`
- **Technologie/nástroje**: Core Data, Network framework (NWPathMonitor)

---

### 5.10 XCTest unit + UI testy

- **Popis**: Unit testy ViewModelů a UI testy kritických flows.
- **Kdo**: `[Claude]`
- **Vstup**: iOS kód z 5.1–5.9
- **Výstup**: XCTest test suite
- **Testy/Revize**: `CMD+U` v Xcode projde všechny testy
- **Claude Code zadání**: `Vytvoř XCTest unit testy pro: APIClient (mock URLSession s URLProtocol), TaskViewModel (mock APIClient, test filtrace a řazení, test hierarchy rodič/podúkol), AuthViewModel (mock Google Sign-In). Přidej XCUITest UI testy pro: login flow, zobrazení kanban boardu, vytvoření úkolu, přidání podúkolu.`
- **Technologie/nástroje**: XCTest, XCUITest, URLProtocol mocking

---

## FÁZE 6: Bezpečnostní audit

### 6.1 OWASP Top 10 kontrola

- **Popis**: Systematická kontrola nejčastějších bezpečnostních zranitelností dle OWASP Top 10 2021.
- **Kdo**: `[Claude]`
- **Vstup**: Kompletní kód z Fází 1–5
- **Výstup**: Bezpečnostní report, opravené zranitelnosti
- **Testy/Revize**: Žádná kritická ani vysoká zranitelnost v reportu
- **Claude Code zadání**: `Proveď code review zaměřený na OWASP Top 10: A01 Broken Access Control (každý endpoint kontroluje autentizaci + user vlastní data přes session user_id), A02 Cryptographic Failures (AES-256-GCM pro Notion token, HTTPS, Secure cookie), A03 Injection (Zod validace všech vstupů, parametrizované SQLite dotazy), A05 Security Misconfiguration (CORS, headers, žádný stack trace v produkci), A07 Auth failures (session invalidace při logout, JWT expirace), A10 SSRF (Notion API URL je hardcoded, ne z user inputu – ověř). Vytvoř security-report.md se zjištěními.`
- **Technologie/nástroje**: Manuální code review, OWASP checklist

---

### 6.2 Dependency audit

- **Popis**: Audit npm a Swift závislostí pro known vulnerabilities.
- **Kdo**: `[Claude]`
- **Vstup**: package.json soubory, Package.swift
- **Výstup**: Opravené zranitelné závislosti
- **Testy/Revize**: `npm audit` vrátí 0 high/critical; Xcode dependency audit čistý
- **Claude Code zadání**: `Spusť npm audit --audit-level=moderate pro každý package. Pro kritické: upgraduj nebo nahraď závislost. Přidej npm audit do CI pipeline (krok před build – již je tam z 0.4). Nastav Dependabot v .github/dependabot.yml pro automatické PR s aktualizacemi npm i Swift závislostí.`
- **Technologie/nástroje**: npm audit, GitHub Dependabot

---

### 6.3 Secret scanning

- **Popis**: Kontrola že žádné secrets nejsou v kódu nebo Git historii.
- **Kdo**: `[Claude]`
- **Vstup**: Git repozitář
- **Výstup**: Čistá Git historie bez secrets, gitleaks v CI
- **Testy/Revize**: gitleaks scan vrátí 0 nalezených secrets
- **Claude Code zadání**: `Přidej gitleaks do CI pipeline jako první krok (již v ci.yml z 0.4). Vytvoř .gitleaks.toml s konfigurací (allow list pro testovací hodnoty jako "test-token-123"). Zkontroluj celou Git historii: gitleaks detect --source . --log-opts="--all". Ověř, že .env soubory jsou v .gitignore a nikdy nebyly commitnuty.`
- **Technologie/nástroje**: gitleaks

---

### 6.4 Penetration testing checklist

- **Popis**: Manuální penetrační testování klíčových bezpečnostních aspektů.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Staging prostředí běžící na VPS
- **Výstup**: Penetrační test report
- **Testy/Revize**: Žádná kritická zranitelnost nenalezena
- **Claude Code zadání**: `Vytvoř penetration-testing-checklist.md: seznam testů pro: SQL injection přes API parametry (better-sqlite3 prepared statements – ověř), XSS přes task název/popis (Notion API escapuje, React escapuje – ale ověř), CSRF (SameSite=Strict cookie + Origin header validace), brute force (rate limiting na /auth/* – ověř), JWT manipulation (změna alg na none – jose knihovna to blokuje – ověř), IDOR (přístup k úkolům jiného uživatele přes notion_config user_id check), open redirect v OAuth flow (state parametr validace), SSRF (hardcoded Notion API URL + UUID validace dbId). Doplň: TLS konfigurace (testssl.sh / Mozilla Observatory), scan security headers (securityheaders.com), ověření cookie flagů (HttpOnly/Secure/SameSite) v reálné odpovědi, kontrola, že /metrics a Traefik dashboard nejsou veřejně přístupné.`
- **Technologie/nástroje**: Burp Suite Community, curl, OWASP ZAP

---

## FÁZE 7: Nasazení

### 7.1 VPS příprava

- **Popis**: Finální příprava produkčního VPS serveru.
- **Kdo**: `[Uživatel]`
- **Vstup**: VPS z 0.5, Traefik z 0.6
- **Výstup**: Produkční prostředí připraveno k deployi
- **Manuální kroky**:
  1. Na VPS: `mkdir -p /opt/notionapp/{data,logs,backups}`
  2. Vytvoř `/opt/notionapp/.env` s produkčními hodnotami (nikdy do Gitu! – viz .env.example pro seznam proměnných)
  3. Nastav logrotate: `nano /etc/logrotate.d/notionapp`
  4. Nastav automatické bezpečnostní aktualizace: `apt install unattended-upgrades && dpkg-reconfigure unattended-upgrades`

---

### 7.2 Docker production build

- **Popis**: Optimalizované multi-stage Docker images pro produkci.
- **Kdo**: `[Claude]`
- **Vstup**: Aplikační kód z Fází 1–3
- **Výstup**: `packages/api/Dockerfile`, `packages/web/Dockerfile` (multi-stage)
- **Testy/Revize**: `docker build` projde; výsledný image < 150MB; container běží jako non-root uživatel
- **Claude Code zadání**: `Vytvoř multi-stage Dockerfile pro api: stage 1 (node:20-alpine AS builder) npm ci + tsup build, stage 2 (node:20-alpine) zkopíruj jen dist/ a node_modules --omit=dev, non-root user "app" (uid 1001), HEALTHCHECK curl /health, dumb-init/tini jako PID 1. Pro web: stage 1 npm ci + vite build, stage 2 (nginx:alpine) zkopíruj dist/, nginx.conf s SPA fallback (try_files $uri /index.html), gzip+brotli kompresí, cache headers pro hashované statické soubory (immutable, 1 rok) a no-cache pro index.html, security headers + web CSP (connect-src API doména, frame-ancestors 'none'). Oba Dockerfiles: minimální .dockerignore, pin base image přes digest. V docker-compose pro produkci přidej hardening: read_only root fs s tmpfs pro /tmp, cap_drop: ALL, security_opt no-new-privileges, mem/cpu limity, restart: unless-stopped, samostatný named volume jen pro /data (SQLite).`
- **Technologie/nástroje**: Docker multi-stage, nginx:alpine, tini/dumb-init

---

### 7.3 GitHub Actions deploy workflow

- **Popis**: Automatický deploy při merge do main s rollback mechanismem při selhání.
- **Kdo**: `[Claude]`
- **Vstup**: GitHub Secrets z 0.7, Docker images z 7.2
- **Výstup**: `.github/workflows/deploy.yml` s kompletním deploy pipeline včetně rollback
- **Testy/Revize**: Merge do main spustí deploy; aplikace dostupná na doméně do 5 minut; při selhání health checku se automaticky rollbackne na předchozí verzi
- **Claude Code zadání**: `Aktualizuj deploy.yml: krok 1 login do GHCR, krok 2 build a push obou images s tagy sha-${{ github.sha }} a latest, krok 3 SSH na VPS: ulož aktuální image tag jako PREVIOUS_TAG, docker pull nových images, docker compose down, docker compose up -d, počkej 30s, krok 4 smoke test (curl /health – pokud selže, SSH zpět na VPS a rollback na PREVIOUS_TAG s docker compose up -d). Přidej GitHub deployment event pro tracking.`
- **Technologie/nástroje**: GitHub Actions, GHCR, appleboy/ssh-action

---

### 7.4 Monitoring + alerting

- **Popis**: Uptime monitoring, alerting při výpadku a monitoring SSL certifikátu.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Běžící produkce z 7.3
- **Výstup**: Uptime Kuma dashboard, notifikace na email/Slack, SSL expiry monitoring
- **Claude Code zadání**: `Přidej Uptime Kuma do infra/docker-compose.yml (louislam/uptime-kuma:1). Přidej /health endpoint do Fastify API: JSON {status: "ok", uptime: process.uptime(), db: "connected", version: process.env.npm_package_version}. Přidej SSL certifikát monitor do Uptime Kuma konfigurace (typ: Certificate expiry, upozornění 14 dní před expirací). Vytvoř monitoring docker compose override soubor.`
- **Manuální kroky**: Přistup na Uptime Kuma UI (:3001), přidej monitor pro API /health, web URL a SSL certifikát, nastav email notifikace
- **Technologie/nástroje**: Uptime Kuma, Fastify health endpoint

---

### 7.5 Backup strategie

- **Popis**: Automatické zálohy SQLite databáze (auth data) na vzdálené úložiště. Úkoly jsou v Notioně – Notion má vlastní zálohy.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Produkční VPS
- **Výstup**: Cron job pro denní zálohy SQLite, zálohy v Backblaze B2 nebo AWS S3
- **Claude Code zadání**: `Vytvoř backup.sh skript: SQLite .backup příkaz (ne cp – .backup je transakčně bezpečné) do timestampovaného souboru /opt/notionapp/backups/db-$(date +%Y%m%d-%H%M%S).sqlite, komprimuj gzip, nahraj do B2/S3 přes rclone nebo aws cli, smaž lokální zálohy starší 7 dní (vzdálené 30 dní). Přidej do /etc/cron.d/ pro spouštění každý den v 3:00. Přidej test zálohy: ověř že SQLite soubor lze otevřít po stažení.`
- **Manuální kroky**: Vytvoř Backblaze B2 bucket, nastav rclone konfiguraci na VPS, otestuj manuální zálohu
- **Technologie/nástroje**: SQLite .backup, rclone, cron

---

## FÁZE 8: Finální revize

### 8.1 Senior developer review checklist

- **Popis**: Kódový review zaměřený na architekturu, výkon a udržovatelnost.
- **Kdo**: `[Claude]`
- **Vstup**: Kompletní kódová báze
- **Výstup**: Review report s doporučeními
- **Claude Code zadání**: `Proveď senior code review: správné error handling (žádné unhandled promises, Swift error propagace), konzistentní naming conventions, DRY princip (žádná duplicita logiky), výkon (Notion API rate limiting funguje, React memoizace tam kde potřeba), TypeScript typy (žádné any, správné generiky), testovatelnost (dependency injection), hierarchie podúkolů (parentId správně propagováno napříč vrstvami). Vytvoř review komentáře přímo v kódu jako TODO/FIXME.`

---

### 8.2 Security expert review checklist

- **Popis**: Finální bezpečnostní kontrola před produkčním spuštěním.
- **Kdo**: `[Claude]`
- **Vstup**: Kód z Fáze 6 + finální verze
- **Výstup**: Security signoff dokument
- **Claude Code zadání**: `Ověř finální stav: HTTPOnly cookie Secure flag v produkci, Notion tokeny nikdy nelogovány (Pino redact konfigurace z 1.1), rate limiting funguje za Traefikem (X-Forwarded-For první IP), SQLite soubor mimo webroot (volume mimo nginx), Docker container běží jako non-root (user app), env soubory v .gitignore, session invalidace funguje (logout smaže SQLite záznam), SSRF ochrana (Notion URL hardcoded).`

---

### 8.3 UI/UX kritický review checklist

- **Popis**: Kontrola uživatelského zážitku, přístupnosti a responsivity.
- **Kdo**: `[Claude]`
- **Vstup**: Běžící frontend aplikace
- **Výstup**: Seznam UX problémů k opravě
- **Claude Code zadání**: `Zkontroluj UI: loading states (skeleton loaders místo spinnerů), error states (user-friendly zprávy, ne raw error objekty), empty states (prázdný kanban má CTA pro vytvoření prvního úkolu), keyboard navigace (Tab pořadí, focus visible), responsivita (funkční na 1280px i 1920px), dark mode (Tailwind dark: třídy), přístupnost (aria-label na ikonách, role atributy), Error Boundary zobrazuje smysluplnou zprávu místo bílé stránky.`

---

### 8.4 Performance audit

- **Popis**: Výkonnostní audit webové aplikace a API response časů.
- **Kdo**: `[Claude]`
- **Vstup**: Produkční nebo staging prostředí
- **Výstup**: Lighthouse report > 90, API latence < 200ms
- **Claude Code zadání**: `Spusť Lighthouse CI audit (přidej do CI s rozpočty – size-limit/bundlesize jako gate, žádný chunk > 500KB). Zkontroluj: lazy loading pro Timeline/Calendar (3.6, 3.7), API caching headers, gzip+brotli v nginx, SQLite WAL aktivní + indexy využity (EXPLAIN QUERY PLAN), Notion queue throttling a write-through cache (1.4). Rozliš dva latence rozpočty: lokální/cache-hit endpointy p95 < 200ms; endpointy závislé na Notion API mají vlastní rozpočet (Notion sám má latenci ~300–800ms) – proto se měří hlavně účinnost cache (cache-hit ratio) a chování fronty při burstu. Přidej load test (k6 nebo autocannon): ověř, že při souběhu klientů fronta drží 3 req/s, 429 se správně retryuje s backoff a server neeskaluje volání na Notion.`
- **Technologie/nástroje**: Lighthouse CI, vite-bundle-visualizer, size-limit, k6/autocannon

---

## Revize plánu (3 iterace × 4 oblasti)

> Tato sekce dokumentuje kompletní revizi plánu ze čtyř pohledů – **Security**, **Výkon a efektivita kódu**, **Testy**, **UX/UI** – provedenou ve třech iteracích. Každá iterace jde hlouběji: 1) zjevné mezery, 2) hlubší/architektonické problémy, 3) jemné/pokročilé detaily. U každého zjištění je odkaz na úkol, kam byla oprava zapracována.

### A) Security

**Iterace 1 – zjevné mezery**
- OAuth flow neměl v implementačním úkolu **PKCE ani validaci `state`** (byly jen v rizicích). → zapracováno do **1.3**.
- iOS endpoint `/auth/mobile` přijímal `id_token` bez ověření. Doplněna **povinná verifikace podpisu proti Google JWKS** (iss/aud/exp/email_verified). → **1.3**.
- AES-256-GCM bez explicitního ukládání **IV a auth tagu** (GCM vyžaduje unikátní IV na zápis). → **1.2** (sloupce `token_iv`, `token_auth_tag`).

**Iterace 2 – hlubší/architektonické**
- `SameSite=Strict` by rozbil návrat z OAuth redirectu → změna na **`SameSite=Lax`** s odůvodněním. → **1.3**.
- Session token: ukládat jen **SHA-256 hash opaque tokenu**, JWT s alg whitelistem (NE `none`). → **1.3**.
- Rate limiting: **pořadí vůči auth** – přidán hrubý IP pre-auth limit pro `/api/*` + `bodyLimit`/timeouty proti DoS. → **1.6**.
- **SSRF/path injection**: validace `database_id`/`parent_id` jako UUID před vložením do API cesty. → **1.4**.
- Chyběla **web (nginx) CSP** s `connect-src` na API doménu (API CSP nestačí). → **1.7**, **7.2**.
- Chyběly **GDPR endpointy** (výmaz/export) a **audit log**. → nová **1.8**.

**Iterace 3 – jemné/pokročilé**
- **Idle + absolute timeout** a rotace session id při loginu. → **1.3**.
- **Rotace šifrovacího klíče** (`key_version`) + cleanup expirovaných sessions. → **1.2**.
- **Supply-chain & container hardening**: CodeQL/semgrep, dependency-review, Trivy scan, pin actions na SHA, `read_only` fs, `cap_drop: ALL`, `no-new-privileges`, limity. → **0.4**, **7.2**.
- Rozšířen **pentest checklist** o TLS test, security-headers scan, ověření cookie flagů (doplněno k **6.4** níže v textu úkolu).

### B) Výkon a efektivita kódu

**Iterace 1 – zjevné mezery**
- `getTasks` bez **stránkování** (Notion vrací max 100/stránku) a bez serverové cache → při 30s pollingu více klientů by narazil na 3 req/s. Přidána **server-side per-user LRU cache (write-through)** + plné stránkování. → **1.4**.
- **N+1** u podúkolů: jeden flat list jako zdroj pravdy, počty/hierarchie počítané klientsky, detail čte z téže cache. → **3.4**, **3.8**.

**Iterace 2 – hlubší/architektonické**
- React Query **polling pauzuje na skrytém tabu** + `refetchOnWindowFocus` (méně volání Notion). → **3.4**.
- **Virtualizace** dlouhých kanban sloupců + `React.memo` na kartách. → **3.5**.
- **Indexy** v SQLite (sessions/users) + WAL + prepared statements. → **1.2**.

**Iterace 3 – jemné/pokročilé**
- **HTTP keep-alive** (undici) na Notion, AbortController timeouty, respekt k `Retry-After`. → **1.4**.
- **brotli + immutable cache** pro statiku, `tini` jako PID 1, multi-stage `--omit=dev`. → **7.2**.
- Realistické **latence rozpočty** (cache-hit vs Notion-bound) + **load test (k6)** chování fronty při burstu. → **8.4**.

### C) Testy

**Iterace 1 – zjevné mezery**
- Doplněny testy **crypto round-tripu s unikátním IV**, session invalidace, JWT `alg=none` blokace (rozšíření **2.1**, ověřeno v **6.4**).
- **Kontraktní testy** proti Notion fixturám + opt-in live smoke test (breaking changes). → **4.4**.

**Iterace 2 – hlubší/architektonické**
- **a11y testy** (axe) v CI, **test data factory**, stabilní `data-testid` a retries pro flaky D&D. → **4.4**, **4.2**.
- Explicitní testy **optimistický rollback**, **401 auto-logout**, rate-limit/CORS/headers (integration). → **2.2**, **4.1**.

**Iterace 3 – jemné/pokročilé**
- **Regresní brány v CI**: size-limit (bundle), Lighthouse budget, container scan. → **4.4**, **0.4**, **8.4**.
- **Load/stress test** fronty (429/backoff), volitelně **mutation testing (Stryker)** pro crypto/auth. → **8.4**, **4.4**.
- iOS: testy přechodu **offline↔online** a Keychain (rozšíření **5.10**).

### D) UX / UI

**Iterace 1 – zjevné mezery**
- Chyběl **globální systém zpětné vazby** (toasty pro success/error). → nová **3.11**.
- Chyběl **focus management** v modálech a explicitní WCAG AA cíl. → nová **3.12**.

**Iterace 2 – hlubší/architektonické**
- **Undo** u mazání, **offline/error banner** s retry, blokace dvojodeslání. → **3.11**.
- **D&D přístupnost** (klávesnice + screen-reader announcements), `prefers-reduced-motion`. → **3.5**, **3.12**.
- **Konflikt s externí úpravou** v Notionu – nenásilný indikátor „aktualizováno". → **3.4**.

**Iterace 3 – jemné/pokročilé**
- **Onboarding**: volitelné automatické vytvoření Notion databáze se správným schématem. → **1.4**.
- **Časová pásma** (date-only Due vs datetime, date-fns-tz, žádné posuny o den), **i18n** příprava, **dark/system theme** s persistencí. → **3.12**.
- **Mobilní/tablet** breakpointy / explicitní desktop-first rozhodnutí, command palette (volitelně). → **3.12**, **3.11**.

---

## Souhrn

### Celkový odhadovaný čas

| Fáze | Odhadovaný čas |
|------|----------------|
| Fáze 0 – Infrastruktura | 1–2 dny |
| Fáze 1 – Backend | 3–5 dní |
| Fáze 2 – Testy backendu | 1–2 dny |
| Fáze 3 – Frontend | 5–8 dní |
| Fáze 4 – Testy frontendu | 2–3 dny |
| Fáze 5 – iOS | 8–12 dní |
| Fáze 6 – Bezpečnostní audit | 1–2 dny |
| Fáze 7 – Nasazení | 1–2 dny |
| Fáze 8 – Finální revize | 1–2 dny |
| **Celkem** | **~25–40 dní** |

---

### Pořadí priorit: MVP vs. Full Feature

**MVP (min. funkční produkt) – 2–3 týdny:**
1. Fáze 0 (celá)
2. Fáze 1 (1.1–1.5)
3. Fáze 3 (3.1–3.5 Kanban + **3.8 Task detail** – bez detailu není Kanban použitelný)
4. Fáze 7 (7.1–7.3)

**Full Feature – zbývající 2–3 týdny:**
- Timeline + Calendar view (3.6, 3.7)
- Search, filtry, keyboard shortcuts (3.9, 3.10)
- Testy (Fáze 2, 4)
- iOS app (Fáze 5)
- Bezpečnostní audit (Fáze 6)
- Monitoring + backup (7.4, 7.5)
- Finální revize (Fáze 8)

---

### Rizika a mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|-----------------|-------|----------|
| Notion API rate limiting (3 req/s) | Vysoká | Střední | Sdílená p-queue 3 req/s + backoff s respektem k Retry-After; **server-side per-user cache (TTL ~20s, write-through)** výrazně snižuje počet volání; React Query polling pauzuje na skrytém tabu (viz 1.4, 3.4) |
| Externí úprava úkolu v Notionu během pollingu | Střední | Střední | Detekce konfliktu přes last_edited_time, nepřepisovat čerstvá data zastaralou mutací, indikátor „aktualizováno" (viz 3.4) |
| Nedostatečná přístupnost (a11y) / právní riziko | Střední | Střední | WCAG AA cíl, automatické axe testy v CI, focus management, kontrast (viz 3.12, 4.4) |
| Slabý onboarding (ruční tvorba Notion DB) | Střední | Střední | Volitelné automatické vytvoření databáze přes Notion API s korektním schématem (viz 1.4) |
| Google OAuth credentials expired/revoked | Nízká | Vysoký | Monitoring platnosti, upozornění přes email |
| SQLite concurrency issues při mnoha uživatelích | Střední | Střední | WAL mode, better-sqlite3 je synchronní (jen jedno vlákno), zvažuj migraci na PostgreSQL při škálování |
| iOS App Store review zamítnutí | Střední | Vysoký | Dodržuj HIG guidelines, testuj na reálném zařízení před odesláním, připrav review notes |
| Notion API breaking changes | Nízká | Vysoký | Pinuj verzi @notionhq/client, sleduj Notion changelog, integration testy zachytí regresi |
| VPS výpadek | Nízká | Vysoký | Uptime Kuma alerting, manuální restart procedura dokumentována, zvažuj 2 VPS s failover |
| JWT secret kompromitace | Velmi nízká | Kritický | Rotace JWT secret = invalidace všech sessions (akceptovatelné); sessions v SQLite umožňují granulární invalidaci bez změny secret |
| Únos Google OAuth callback | Nízká | Kritický | Whitelist redirect URIs v Google Console, validuj state parametr, PKCE flow |
| Deploy selhání v produkci | Střední | Vysoký | Automatický rollback na předchozí image tag při selhání health checku (viz 7.3) |
| SSL certifikát expiruje | Nízká | Vysoký | Traefik obnovuje automaticky; Uptime Kuma monitoruje 14 dní před expirací (viz 7.4) |
