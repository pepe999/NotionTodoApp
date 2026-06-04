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

- [ ] **FÁZE 0** – Příprava a infrastruktura
- [ ] **FÁZE 1** – Backend API (Fastify + TypeScript)
- [ ] **FÁZE 2** – Testy backendu
- [ ] **FÁZE 3** – Frontend Web (React + Vite)
- [ ] **FÁZE 4** – Testy frontendu
- [ ] **FÁZE 5** – iOS (SwiftUI)
- [ ] **FÁZE 6** – Bezpečnostní audit
- [ ] **FÁZE 7** – Nasazení
- [ ] **FÁZE 8** – Finální revize

---

## FÁZE 0: Příprava a infrastruktura

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
- **Claude Code zadání**: `Vytvoř GitHub Actions ci.yml: spustí se na PR do main/develop, kroky: gitleaks secret scan, checkout, setup Node 20, npm ci, npm run lint, npm audit --audit-level=high (CI selhává pouze na high/critical zranitelnostech – moderate se řeší v Dependabot PR, ne při každém buildu), npm run test, npm run build. Vytvoř deploy.yml: spustí se na push do main, build Docker images, push na GHCR, SSH deploy na VPS přes appleboy/ssh-action s rollback krokem. Vytvoř ios-ci.yml s workflow_dispatch triggerem (manuální spuštění): macos-latest runner, xcodebuild test.`
- **Technologie/nástroje**: GitHub Actions, GHCR, appleboy/ssh-action

---

### 0.5 VPS server setup

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
     - `GOOGLE_CLIENT_ID` = z Google Cloud Console – Web client (viz 1.3)
     - `GOOGLE_CLIENT_SECRET` = z Google Cloud Console – Web client
     - `GOOGLE_CLIENT_ID_IOS` = z Google Cloud Console – iOS client (viz 5.3)
     - `JWT_SECRET` = náhodný string: `openssl rand -base64 64`
     - `NOTION_ENCRYPTION_KEY` = náhodný 32B klíč: `openssl rand -hex 32` (výstup je 64 hex znaků = 32 bajtů; backend ověří délku při startu)
     - `BACKUP_ENCRYPTION_KEY` = zálohovací heslo: `openssl rand -base64 32`
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
- **Claude Code zadání**: `V packages/api nastav Fastify 5 projekt: package.json (fastify@5, @fastify/cors, @fastify/cookie, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui, fastify-plugin, zod, better-sqlite3, pino), tsconfig.json extendující base, src/env.ts (Zod validace všech env proměnných při startu – process.exit(1) při chybějící proměnné), src/server.ts (Fastify instance s trustProxy: 1 pro správné X-Forwarded-For za Traefikem, globální setErrorHandler vracející sanitizované JSON chyby bez stack trace v produkci, Pino s redact: ["req.headers.authorization", "body.token", "body.integration_token"], registrace pluginů), src/index.ts. @fastify/swagger-ui registruj podmíněně pouze v NODE_ENV !== "production". Přidej tsx pro dev, tsup pro build.`
- **Technologie/nástroje**: Fastify 5.x, tsx, tsup, Husky 9.x, lint-staged, Zod (env validace)

---

### 1.2 SQLite schema (users, sessions, notion_configs) + migrace

- **Popis**: Definice databázového schématu pouze pro auth data (úkoly jsou v Notioně). Migrace jsou číslované SQL soubory s `schema_migrations` tabulkou pro bezpečné schema změny v produkci.
- **Kdo**: `[Claude]`
- **Vstup**: Backend projekt z 1.1
- **Výstup**: `src/db/index.ts`, `src/db/migrations/001_init.sql`, migrace runner, inicializační skript
- **Testy/Revize**: `npm run db:migrate` vytvoří SQLite soubor se správnými tabulkami; spuštění znovu je idempotentní
- **Claude Code zadání**: `Vytvoř src/db/index.ts (inicializace better-sqlite3, WAL mode, foreign keys ON, připojení k souboru z DATABASE_PATH env). Vytvoř src/db/migrations/ runner: čte všechny *.sql soubory seřazené dle čísla, ukládá provedené migrace do schema_migrations tabulky, přeskočí již provedené. Migrace 001_init.sql: tabulky users (id TEXT PK, google_id TEXT UNIQUE, email TEXT UNIQUE, name TEXT, avatar_url TEXT, created_at INTEGER), sessions (id TEXT PK, user_id TEXT FK→users, token_hash TEXT UNIQUE, expires_at INTEGER, created_at INTEGER), notion_configs (id TEXT PK, user_id TEXT UNIQUE FK→users, integration_token_encrypted TEXT, database_id TEXT, validated_at INTEGER, created_at INTEGER, updated_at INTEGER). Přidej AES-256-GCM šifrování Notion tokenu přes Node.js crypto modul v src/db/encryption.ts: klíč načíst jako Buffer.from(key, "hex") – vždy ověřit délku 32 bajtů (process.exit(1) jinak), IV generovat crypto.randomBytes(12) pro každé šifrování zvlášť, serializovat jako Buffer.concat([iv(12), authTag(16), ciphertext]).toString("base64"). Nikdy nepoužívat statický IV.`
- **Technologie/nástroje**: better-sqlite3 9.x, Node.js crypto (built-in)

---

### 1.3 Google OAuth 2.0 flow + session management

- **Popis**: Implementace OAuth 2.0 flow s JWT v HTTPOnly cookie. Sessions jsou uloženy v SQLite (umožňuje logout a invalidaci konkrétní session bez změny JWT_SECRET). Refresh probíhá automaticky prodloužením session při aktivitě.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Google Cloud Console setup (manuální), SQLite schema z 1.2
- **Výstup**: Funkční `/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/logout` endpointy
- **Testy/Revize**: Přihlášení přes Google funguje; cookie se nastaví; `/auth/me` vrátí uživatele; logout smaže session ze SQLite
- **Claude Code zadání**: `Implementuj src/plugins/auth.ts: Google OAuth 2.0 redirect flow (bez google-auth-library – použij standardní OAuth2 s fetch pro token exchange a Google Identity API pro userinfo na https://www.googleapis.com/oauth2/v3/userinfo). CSRF ochrana: při /auth/google vygeneruj crypto.randomBytes(32).toString("hex") jako state, ulož do HTTPOnly cookie oauth_state s SameSite=Lax a maxAge=600 (10 min) – Lax je nutné pro OAuth redirect z Googlu; při /auth/google/callback ověř state vůči cookie a okamžitě smaž oauth_state cookie. PKCE: vygeneruj codeVerifier (randomBytes(32).toString("base64url")), spočítej codeChallenge (SHA-256 → base64url), ulož verifier do session cookie, přidej code_challenge a code_challenge_method=S256 do Google OAuth URL, v callbacku pošli code_verifier při token exchange. Vygeneruj JWT (jose library) s expirací 7 dní, ulož bcrypt hash session tokenu do SQLite sessions tabulky. HTTPOnly Secure SameSite=Strict cookie pro session JWT. Přidej middleware pro ověření JWT + kontrolu existence session v SQLite (umožňuje invalidaci). Logout: smaže session z DB, clearCookie. Endpoint /auth/mobile pro iOS Google Sign-In SDK (přijme id_token, verifikuj ho vůči https://oauth2.googleapis.com/tokeninfo?id_token=XXX, ověř aud === GOOGLE_CLIENT_ID_IOS a exp > now(), vrátí session cookie).`
- **Technologie/nástroje**: jose (JWT), @fastify/cookie, Google Identity API (https://www.googleapis.com/oauth2/v3/userinfo)
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
- **Claude Code zadání**: `Vytvoř src/services/notion.ts s NotionService třídou: metody validateDatabase(token, dbId) která ověří existenci a typy sloupců: Name=title, Status=select (options: Todo/In Progress/Review/Done), Tags=multi_select, Due=date, Timeline=date, Owner=people, Description=rich_text, DependsOn=relation (self-referencing). Podúkoly jsou nativní Sub-items – dotazuj přes filter {property: "parent_page_id"} nebo pomocí blocks API. getTasks() vrátí flat list + parent_id pro hierarchii, createTask(), updateTask(), deleteTask(), createSubtask(parentId). Implementuj request queue s rate limiting 3 req/s (Notion API limit) a exponential backoff. Všechna volání mají timeout 10s. Endpoint POST /api/setup: přijme token a dbId, zavolá validateDatabase, při úspěchu zašifruje a uloží do notion_configs.`
- **Technologie/nástroje**: @notionhq/client 2.x, p-queue pro request throttling

---

### 1.5 Tasks CRUD API (s Zod validací + OpenAPI dokumentace)

- **Popis**: Kompletní CRUD endpointy pro úkoly s Zod validací vstupů a výstupů. Swagger UI dostupné na `/docs` pro snadné testování a dokumentaci.
- **Kdo**: `[Claude]`
- **Vstup**: NotionService z 1.4
- **Výstup**: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `POST /api/tasks/:id/subtasks`, Zod schémata v `packages/shared`, Swagger UI na `/docs`
- **Testy/Revize**: Všechny endpointy vrátí validovaná data; neplatné vstupy vrátí 400 s popisem chyby; `/docs` zobrazí OpenAPI dokumentaci v development, v produkci vrátí 404
- **Claude Code zadání**: `V packages/shared/src/schemas.ts vytvoř Zod schémata pro Task (name: string, status: enum(Todo/InProgress/Review/Done), tags: string[], dueDate: date optional, timeline: {start: date, end: date} optional, ownerIds: string[], description: string optional, dependsOnIds: string[], parentId: string optional). V packages/api vytvoř src/routes/tasks.ts: GET /api/tasks (query params: search, tags, status, parentId), POST /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id, DELETE /api/tasks/:id, POST /api/tasks/:id/subtasks. Každý endpoint: auth middleware + Zod validace + @fastify/swagger JSON schema. Přidej /api/tasks/:id/subtasks GET endpoint vracející child tasks.`
- **Technologie/nástroje**: Zod 3.x, packages/shared workspace, @fastify/swagger, @fastify/swagger-ui

---

### 1.6 Rate limiting middleware

- **Popis**: Rate limiting dvouúrovňový: 120 požadavků za 60 sekund per IP pro `/auth/*`, plus 300 požadavků za 60 sekund per user ID pro `/api/*` (autentizované endpointy – chrání i uživatele za NAT/VPN sdílející IP).
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1, auth middleware z 1.3
- **Výstup**: Rate limiting aktivní na všech routách
- **Testy/Revize**: Po překročení limitu vrátí 429 s Retry-After hlavičkou
- **Claude Code zadání**: `Nakonfiguruj @fastify/rate-limit plugin dvakrát: pro /auth/* keyGenerator podle IP (trustProxy: 1 je nastaveno na Fastify instanci v 1.1 – správně vezme první IP z X-Forwarded-For, ne IP Traefiku), pro /api/* keyGenerator podle req.user.id (dostupný po auth middleware), max 300 req za 60s. Custom errorMessage v JSON formátu s retryAfter hodnotou. Přidaj RateLimit-* headers do response. Ověř, že keyGenerator pro /auth/* bere req.ip (po trustProxy: 1 je to klientova IP, ne Traefik).`
- **Technologie/nástroje**: @fastify/rate-limit

---

### 1.7 CORS + security headers

- **Popis**: CORS omezení pouze na povolené originy, Helmet security headers, CSP politika.
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1
- **Výstup**: CORS a security headers aktivní
- **Testy/Revize**: Request z nepovolené domény vrátí CORS chybu; headers obsahují CSP, HSTS, X-Frame-Options
- **Claude Code zadání**: `Nakonfiguruj @fastify/cors: origin povoleno pouze pro FRONTEND_URL env proměnnou (v dev http://localhost:5173), credentials: true. Nakonfiguruj @fastify/helmet s CSP politikou (default-src 'self', script-src 'self', style-src 'self' 'unsafe-inline' – unsafe-inline je nutné pro Tailwind CSS generované styly, přijatelné riziko pro styly na rozdíl od skriptů). Přidej HSTS header pro produkci (Strict-Transport-Security: max-age=63072000; includeSubDomains). Ověř, že Fastify nevystavuje X-Powered-By header. Poznámka: pokud bude použit SSR nebo nonce-based approach, nahradit unsafe-inline nonce-em pro přísnější CSP.`
- **Technologie/nástroje**: @fastify/cors, @fastify/helmet

---

## FÁZE 2: Testy backendu (Test-first přístup)

### 2.1 Unit testy (Vitest) – services, validators

- **Popis**: Unit testy pro NotionService, Zod validátory, šifrovací funkce a auth helpery.
- **Kdo**: `[Claude]`
- **Vstup**: Backend kód z Fáze 1
- **Výstup**: `packages/api/src/**/*.test.ts`, pokrytí >80%
- **Testy/Revize**: `npm run test` projde; coverage report >80%
- **Claude Code zadání**: `Vytvoř unit testy (Vitest) pro: NotionService.validateDatabase (mock @notionhq/client – testuj správné i nesprávné sloupce), NotionService rate limiting (ověř že queue throttluje na 3 req/s), Zod schémata (platné/neplatné vstupy pro Task), šifrování/dešifrování Notion tokenu (round-trip test, ověř že každé šifrování generuje jiný IV – porovnej dva zašifrované výstupy stejného textu), JWT generování a validaci, session invalidace, OAuth state validace (ověř že callback s neplatným state vrátí 400). Použij vi.mock pro external závislosti. Nastav vitest.config.ts s coverage reportem (provider: v8, threshold: 80%).`
- **Technologie/nástroje**: Vitest 2.x, @vitest/coverage-v8

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
- **Claude Code zadání**: `V packages/web inicializuj Vite React TypeScript projekt. Nastav Tailwind CSS v3 (shadcn/ui má plnou stabilní podporu pro v3; Tailwind v4 má breaking changes v konfiguraci a kompatibilita se shadcn/ui není garantována – přechod na v4 provést až po oficálním shadcn/ui oznámení podpory). Přidej shadcn/ui (init s New York style, zinc barvy). Nakonfiguruj path aliasy (@/ → src/). Přidej základní layout: App.tsx s React Router (react-router-dom v7), stránky: LoginPage, SetupPage, DashboardPage. Přidej Error Boundary komponentu pro zachycení runtime chyb. Přidej Poppins font přes Google Fonts. Nastav Vite proxy pro /api/* → http://localhost:3000 v dev módu.`
- **Technologie/nástroje**: Vite 6.x, React 19, Tailwind CSS 3.x, Shadcn/ui, React Router 7.x

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
- **Claude Code zadání**: `Vytvoř Zustand store pro UI state (activeView: kanban|timeline|calendar, openTaskId, filters: {search, tags, status}). Vytvoř React Query hooks: useTasksQuery (refetchInterval: 30000, staleTime: 25000), useCreateTask (optimistický update – onMutate přidá task s temp ID, onError rollback, onSettled invalidate), useUpdateTask, useDeleteTask, useCreateSubtask (přidá child task s parentId). Vytvoř src/api/client.ts (fetch wrapper s credentials: "include", error handling, automatický logout při 401).`
- **Technologie/nástroje**: Zustand 5.x, TanStack Query 5.x

---

### 3.5 Kanban board view (dnd-kit)

- **Popis**: Kanban board s sloupci pro každý status (Todo, In Progress, Review, Done), drag & drop přesun mezi sloupci. Zobrazuje pouze top-level úkoly (ne podúkoly).
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/KanbanView.tsx`, funkční drag & drop s optimistickým přesunem
- **Testy/Revize**: Přetažení karty aktualizuje status; podúkoly se zobrazí jako badge s počtem na kartě rodiče
- **Claude Code zadání**: `Vytvoř KanbanView komponentu: 4 sloupce (Todo/In Progress/Review/Done) s @dnd-kit/core a @dnd-kit/sortable. Každá karta (TaskCard) zobrazuje: název, tagy (barevné badges), due date (červená pokud po termínu), avatar ownera, počet podúkolů jako badge (kliknutí otevře detail). Filtruj jen tasks bez parentId pro hlavní view. Drop target zvýrazní sloupec. Po dropu zavolej useUpdateTask s novým statusem. Sloupce mají počítadlo úkolů v headeru. Přidej empty state s CTA tlačítkem "Vytvořit první úkol".`
- **Technologie/nástroje**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

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

## FÁZE 5: iOS (SwiftUI)

### 5.1 Xcode projekt setup, architektura (MVVM)

- **Popis**: Inicializace Xcode projektu s MVVM architekturou, targets pro app a testy. Xcode projekt je v `packages/ios/` jako součást monorepa, ale buildí se výhradně lokálně v Xcode (ne v Dockeru).
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Mac s Xcode 15+
- **Výstup**: Xcode projekt v `packages/ios/`, MVVM folder struktura, .gitignore pro Xcode artefakty
- **Testy/Revize**: Build a spuštění na iOS Simulator (iPhone 15, iOS 17)
- **Claude Code zadání**: `Vytvoř packages/ios/ se strukturou: Models/, ViewModels/, Views/, Services/, Components/. Přidej základní App.swift, ContentView.swift, AppRouter pro navigaci. Nastav SwiftLint konfiguraci. Uprav kořenový .gitignore: přidej *.xcuserstate, xcuserdata/, DerivedData/, *.ipa. Nastav Swift 6 language mode v Package.swift (swift-tools-version: 6.0); opatři ViewModely atributem @MainActor, APIClient implementuj jako actor pro thread safety v Swift 6 strict concurrency modelu.`
- **Manuální kroky**: Otevři Xcode 16 → New Project → iOS App → NotionTodoApp, uložení do packages/ios/
- **Technologie/nástroje**: Xcode 16, Swift 6.0, SwiftUI, SwiftLint
- **Poznámka k verzi**: Swift 6 zavádí strict concurrency – všechny async operace v ViewModelech musí být @MainActor nebo explicitně Sendable. Migrace z Swift 5.9 na 6.0 vyžaduje úpravu async/await kódu.

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
- **Claude Code zadání**: `Implementuj AuthViewModel jako @MainActor class s @Published currentUser. Přidej Google Sign-In Swift Package (GoogleSignIn-iOS). Po úspěšném Google Sign-In pošli id_token na backend /auth/mobile endpoint (backend verifikuje token vůči Google – viz 1.3), dostaneš Set-Cookie header – ulož cookie do HTTPCookieStorage.shared (nikoliv do Keychain – HTTPOnly cookie záměrně nemá být čitelná aplikací; HTTPCookieStorage ji persistuje automaticky mezi restarty přes standardní iOS cookie storage). Nastav URLSessionConfiguration.default.httpCookieStorage = .shared a httpShouldSetCookies = true. Naslouchej NotificationCenter 401 událostem z APIClient pro automatický logout.`
- **Manuální kroky**: V Google Cloud Console přidej iOS OAuth client s Bundle ID tvé aplikace; přidej `GOOGLE_CLIENT_ID_IOS` do GitHub Secrets a env vars
- **Technologie/nástroje**: GoogleSignIn Swift Package, URLSession cookie storage (bez Keychain – HTTPCookieStorage persistuje automaticky)

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
- **Claude Code zadání**: `V iOS app: requestAuthorization pro notifikace, registrace pro remote notifications, odeslání device tokenu na backend POST /api/notifications/register. V backendu: přidej tabulku device_tokens (id, user_id, token, platform, created_at) do SQLite migrace 002, node-apn pro odesílání, node-cron každou hodinu kontrolující tasks z Notion API s due date za 24h a odesílající APNs notifikaci.`
- **Manuální kroky**: V Apple Developer Portal vytvoř APNs klíč (.p8 soubor) a přidej ho jako GitHub Secret `APNS_KEY`
- **Technologie/nástroje**: UserNotifications framework, node-apn, node-cron

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
- **Claude Code zadání**: `Vytvoř penetration-testing-checklist.md: seznam testů pro: SQL injection přes API parametry (better-sqlite3 prepared statements – ověř), XSS přes task název/popis (Notion API escapuje, React escapuje – ale ověř), CSRF (SameSite=Strict cookie + Origin header validace), brute force (rate limiting na /auth/* – ověř), JWT manipulation (změna alg na none – jose knihovna to blokuje – ověř), IDOR (přístup k úkolům jiného uživatele přes notion_config user_id check), open redirect v OAuth flow (state parametr validace), SSRF (hardcoded Notion API URL).`
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
- **Claude Code zadání**: `Vytvoř multi-stage Dockerfile pro api: stage 1 (node:20-alpine AS builder) npm ci + tsup build, stage 2 (node:20-alpine) zkopíruj jen dist/ a node_modules --production, non-root user "app" (uid 1001), HEALTHCHECK curl /health. Pro web: stage 1 npm ci + vite build, stage 2 (nginx:alpine) zkopíruj dist/, nginx.conf s SPA fallback (try_files $uri /index.html), gzip kompresí a cache headers pro statické soubory. Oba Dockerfiles: minimální .dockerignore.`
- **Technologie/nástroje**: Docker multi-stage, nginx:alpine

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
- **Claude Code zadání**: `Přidej Uptime Kuma do infra/docker-compose.yml (louislam/uptime-kuma:1). Přidej /health endpoint do Fastify API: JSON {status: "ok", uptime: process.uptime(), db: "connected"} – nevystavuj version (information disclosure – pomáhá útočníkovi cílit na CVE konkrétní verze). Přidej SSL certifikát monitor do Uptime Kuma konfigurace (typ: Certificate expiry, upozornění 14 dní před expirací). Vytvoř monitoring docker compose override soubor.`
- **Manuální kroky**: Přistup na Uptime Kuma UI (:3001), přidej monitor pro API /health, web URL a SSL certifikát, nastav email notifikace
- **Poznámka k architektuře**: Uptime Kuma běží na stejném hostiteli jako aplikace – při výpadku hostitele selže zároveň s aplikací. Pro kritické produkce zvažte externí monitoring (Better Uptime, Checkly) jako doplněk.
- **Technologie/nástroje**: Uptime Kuma, Fastify health endpoint

---

### 7.5 Backup strategie

- **Popis**: Automatické zálohy SQLite databáze (auth data) na vzdálené úložiště. Úkoly jsou v Notioně – Notion má vlastní zálohy.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Produkční VPS
- **Výstup**: Cron job pro denní zálohy SQLite, zálohy v Backblaze B2 nebo AWS S3
- **Claude Code zadání**: `Vytvoř backup.sh skript: SQLite .backup příkaz (ne cp – .backup je transakčně bezpečné) do timestampovaného souboru /tmp/db-$(date +%Y%m%d-%H%M%S).sqlite, komprimuj gzip, šifruj pomocí GPG symetrickým šifrováním AES256 s heslem z env proměnné BACKUP_ENCRYPTION_KEY (gpg --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" --symmetric --cipher-algo AES256 soubor.gz), nahraj .gpg soubor do B2/S3 přes rclone, smaž lokální dočasné soubory. Smaž vzdálené zálohy starší 30 dní. Přidej do /etc/cron.d/ pro spouštění každý den v 3:00. Přidej test zálohy: stáhni, dešifruj a ověř že SQLite soubor lze otevřít (sqlite3 file.sqlite ".tables"). Přidej BACKUP_ENCRYPTION_KEY do .env.example a GitHub Secrets.`
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
- **Claude Code zadání**: `Spusť Lighthouse CI audit (přidej do CI jako volitelný krok). Zkontroluj: bundle size (vite-bundle-visualizer – žádný chunk > 500KB), lazy loading pro Timeline a Calendar view (React.lazy + Suspense – již v 3.6, 3.7), API response caching headers, gzip komprese v nginx, SQLite WAL mode aktivní, Notion API queue throttling (3 req/s), p95 latence < 200ms.`
- **Technologie/nástroje**: Lighthouse CI, vite-bundle-visualizer

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
| Notion API rate limiting (3 req/s) | Vysoká | Střední | p-queue s throttlingem 3 req/s + exponential backoff; cache responses 30s v React Query |
| Google OAuth credentials expired/revoked | Nízká | Vysoký | Monitoring platnosti, upozornění přes email |
| SQLite concurrency issues při mnoha uživatelích | Střední | Střední | WAL mode, better-sqlite3 je synchronní (jen jedno vlákno), zvažuj migraci na PostgreSQL při škálování |
| iOS App Store review zamítnutí | Střední | Vysoký | Dodržuj HIG guidelines, testuj na reálném zařízení před odesláním, připrav review notes |
| Notion API breaking changes | Nízká | Vysoký | Pinuj verzi @notionhq/client, sleduj Notion changelog, integration testy zachytí regresi |
| VPS výpadek | Nízká | Vysoký | Uptime Kuma alerting + externí monitor (Checkly/Better Uptime), manuální restart procedura dokumentována |
| JWT secret kompromitace | Velmi nízká | Kritický | Rotace JWT secret = invalidace všech sessions (akceptovatelné); sessions v SQLite umožňují granulární invalidaci bez změny secret |
| Únos Google OAuth callback | Nízká | Kritický | Whitelist redirect URIs v Google Console, state parametr CSRF ochrana (implementováno v 1.3), PKCE flow (implementováno v 1.3) |
| Deploy selhání v produkci | Střední | Vysoký | Automatický rollback na předchozí image tag při selhání health checku (viz 7.3) |
| SSL certifikát expiruje | Nízká | Vysoký | Traefik obnovuje automaticky; Uptime Kuma monitoruje 14 dní před expirací (viz 7.4) |
| Swift 6 strict concurrency breaking changes | Střední | Střední | Xcode 16 + Swift 6; ViewModely jako @MainActor, APIClient jako actor (viz 5.1) |
| Tailwind/shadcn/ui nekompatibilita | Nízká | Střední | Použit Tailwind v3 (plná podpora shadcn/ui); přechod na v4 až po oficálním oznámení |
| Backup únik (SQLite s tokeny) | Nízká | Vysoký | Zálohy šifrovány GPG AES-256 před uploadem do B2/S3 (viz 7.5) |
