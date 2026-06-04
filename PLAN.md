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
- **Claude Code zadání**: `Inicializuj Git repozitář, vytvoř .gitignore pro Node.js/TypeScript/Swift/Docker, vytvoř základní adresářovou strukturu monorepa a commitni.`
- **Technologie/nástroje**: Git, GitHub
- **Manuální kroky (Uživatel)**:
  1. Jdi na https://github.com/new, vytvoř repozitář `NotionTodoApp` (private)
  2. Settings → Branches → Add rule: větev `main`, zaškrtni "Require pull request before merging", "Require status checks to pass"
  3. Zkopíruj remote URL a spusť: `git remote add origin <URL>`

---

### 0.2 Monorepo struktura

- **Popis**: Nastavení monorepa s npm workspaces. Struktura: `packages/api`, `packages/web`, `packages/ios`, `packages/shared` (sdílené Zod schémata, typy).
- **Kdo**: `[Claude]`
- **Vstup**: Inicializovaný Git repozitář
- **Výstup**: `package.json` s workspaces, `tsconfig.base.json`, adresářová kostra všech packages
- **Testy/Revize**: `npm install` z kořene nainstaluje závislosti všech packages
- **Claude Code zadání**: `Vytvoř monorepo strukturu: kořenový package.json s workspaces ["packages/*"], tsconfig.base.json se striktním TypeScriptem, a prázdné package.json pro packages/api, packages/web, packages/shared. Přidej základní ESLint a Prettier konfig na kořenové úrovni.`
- **Technologie/nástroje**: npm workspaces, TypeScript 5.x, ESLint 9.x, Prettier 3.x

---

### 0.3 Docker + docker-compose pro lokální vývoj

- **Popis**: Docker Compose konfigurace pro lokální vývoj: api (Node.js s hot-reload), web (Vite dev server), sqlite volume.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura z 0.2
- **Výstup**: `docker-compose.yml`, `docker-compose.override.yml`, `packages/api/Dockerfile.dev`, `packages/web/Dockerfile.dev`
- **Testy/Revize**: `docker compose up` spustí všechny služby; api dostupné na :3000, web na :5173
- **Claude Code zadání**: `Vytvoř docker-compose.yml s službami: api (Node 20 Alpine, volume mount pro hot-reload, port 3000), web (Node 20 Alpine, Vite, port 5173), sqlite-data volume. Přidej .dockerignore soubory. Použij named volumes pro node_modules.`
- **Technologie/nástroje**: Docker 24+, Docker Compose v2, Node 20 Alpine

---

### 0.4 CI/CD GitHub Actions pipeline

- **Popis**: GitHub Actions workflow pro CI (lint, test, build) na každém PR a CD (deploy na VPS) při merge do main.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura, Docker soubory
- **Výstup**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- **Testy/Revize**: Push PR spustí CI; merge do main spustí deploy workflow (deploy selže dokud není VPS připraven)
- **Claude Code zadání**: `Vytvoř GitHub Actions workflow ci.yml: spustí se na PR do main/develop, kroky: checkout, setup Node 20, npm ci, npm run lint, npm run test, npm run build. Vytvoř deploy.yml: spustí se na push do main, kroky: build Docker images, push na GHCR, SSH deploy na VPS přes appleboy/ssh-action.`
- **Technologie/nástroje**: GitHub Actions, GHCR (GitHub Container Registry), appleboy/ssh-action

---

### 0.5 VPS server setup

- **Popis**: Příprava Ubuntu VPS serveru – instalace Dockeru, nastavení firewallu, SSH klíče, uživatel pro deploy.
- **Kdo**: `[Uživatel]` (manuální kroky)
- **Vstup**: Hetzner nebo DigitalOcean účet
- **Výstup**: VPS s Ubuntu 22.04, Docker, firewall, deploy uživatel
- **Testy/Revize**: SSH přihlášení funguje; `docker ps` běží bez sudo
- **Manuální kroky**:
  1. Na https://console.hetzner.cloud vyber "New Server": Ubuntu 22.04, CX21 (2 vCPU, 4GB RAM)
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
- **Claude Code zadání**: `Vytvoř infra/traefik/ adresář s docker-compose.yml (Traefik 3.x, sítě: traefik-public), traefik.yml (entrypoints http/https, certresolver letsencrypt), acme.json soubor s chmod 600. Přidej Traefik labels do api a web služeb v docker-compose.yml.`
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
     - `GOOGLE_CLIENT_ID` = z Google Cloud Console (viz 1.3)
     - `GOOGLE_CLIENT_SECRET` = z Google Cloud Console
     - `JWT_SECRET` = náhodný string: `openssl rand -base64 64`
     - `GHCR_TOKEN` = GitHub Personal Access Token s `write:packages`
     - `DOMAIN` = tvoje doména (např. `notionapp.example.com`)

---

## FÁZE 1: Backend API (Fastify + TypeScript)

### 1.1 Projekt setup, ESLint, Prettier, Husky

- **Popis**: Inicializace `packages/api` s Fastify, TypeScript, vývojovými nástroji a Husky pre-commit hooky.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo z 0.2
- **Výstup**: Funkční Fastify server na :3000, ESLint + Prettier integrace, Husky pre-commit lint
- **Testy/Revize**: `npm run dev` spustí server; `npm run lint` projde bez chyb
- **Claude Code zadání**: `V packages/api nastav Fastify projekt: package.json (fastify@4, @fastify/cors, @fastify/cookie, @fastify/helmet, @fastify/rate-limit, fastify-plugin, zod, @sinclair/typebox, better-sqlite3, pino), tsconfig.json extendující base, src/server.ts (vytvoř Fastify instanci, zaregistruj pluginy, exportuj pro testy), src/index.ts (spustí server). Přidej tsx pro dev, tsup pro build.`
- **Technologie/nástroje**: Fastify 4.x, tsx, tsup, Husky 9.x, lint-staged

---

### 1.2 SQLite schema (users, sessions, notion_configs)

- **Popis**: Definice databázového schématu a migrace pro ukládání uživatelů, sessions a Notion konfigurací.
- **Kdo**: `[Claude]`
- **Vstup**: Backend projekt z 1.1
- **Výstup**: `src/db/schema.ts`, `src/db/migrations/`, inicializační skript
- **Testy/Revize**: `npm run db:migrate` vytvoří SQLite soubor se správnými tabulkami
- **Claude Code zadání**: `Vytvoř src/db/index.ts (inicializace better-sqlite3, WAL mode, foreign keys), src/db/schema.sql s tabulkami: users (id, google_id, email, name, avatar_url, created_at), sessions (id, user_id, token_hash, expires_at, created_at), notion_configs (id, user_id, integration_token_encrypted, database_id, validated_at, created_at, updated_at). Přidej AES-256 šifrování Notion tokenu přes Node.js crypto modul.`
- **Technologie/nástroje**: better-sqlite3 9.x, Node.js crypto (built-in)

---

### 1.3 Google OAuth 2.0 flow + JWT sessions

- **Popis**: Implementace OAuth 2.0 flow: redirect na Google, callback, výměna kódu za token, uložení uživatele, vydání JWT v HTTPOnly cookie.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Google Cloud Console setup (manuální), SQLite schema z 1.2
- **Výstup**: Funkční `/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/logout` endpointy
- **Testy/Revize**: Přihlášení přes Google funguje; cookie se nastaví; `/auth/me` vrátí uživatele
- **Claude Code zadání**: `Implementuj src/plugins/auth.ts: Google OAuth flow s google-auth-library, generování JWT (jose library) s expirací 30 dní, ukládání do HTTPOnly Secure SameSite=Strict cookie. Vytvoř src/routes/auth.ts s endpointy. Přidej middleware pro ověření JWT na chráněných routách.`
- **Technologie/nástroje**: google-auth-library, jose (JWT), @fastify/cookie
- **Manuální kroky (Google Cloud Console)**:
  1. Jdi na https://console.cloud.google.com → New Project: `NotionTodoApp`
  2. APIs & Services → Enable APIs → vyhledej "Google+ API" a "Google Identity" → Enable
  3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
  4. Application type: Web application, Name: `NotionTodoApp`
  5. Authorized redirect URIs: `http://localhost:3000/auth/google/callback` a `https://api.yourdomain.com/auth/google/callback`
  6. Zkopíruj Client ID a Client Secret → ulož do GitHub Secrets (viz 0.7)

---

### 1.4 Notion integration service + Setup wizard endpoint

- **Popis**: Notion API klient, validace databáze (ověření 9 povinných sloupců se správnými typy), setup wizard endpoint.
- **Kdo**: `[Claude]`
- **Vstup**: Auth middleware z 1.3
- **Výstup**: `src/services/notion.ts`, `POST /api/setup/validate`, `POST /api/setup/save`
- **Testy/Revize**: Validace vrátí chybu pro neexistující sloupce; úspěch pro správnou DB
- **Claude Code zadání**: `Vytvoř src/services/notion.ts s NotionService třídou: metody validateDatabase(token, dbId) která ověří existenci a typy sloupců (Name=title, Status=select, Tags=multi_select, Due=date, Timeline=date, Owner=people, Description=rich_text, Subtasks=rich_text, DependsOn=relation), getTasks(), createTask(), updateTask(), deleteTask(). Použij @notionhq/client. Endpoint POST /api/setup: přijme token a dbId, zavolá validateDatabase, při úspěchu zašifruje a uloží do notion_configs.`
- **Technologie/nástroje**: @notionhq/client 2.x

---

### 1.5 Tasks CRUD API (s Zod validací)

- **Popis**: Kompletní CRUD endpointy pro úkoly s Zod validací vstupů a výstupů.
- **Kdo**: `[Claude]`
- **Vstup**: NotionService z 1.4
- **Výstup**: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, Zod schémata v `packages/shared`
- **Testy/Revize**: Všechny endpointy vrátí validovaná data; neplatné vstupy vrátí 400 s popisem chyby
- **Claude Code zadání**: `V packages/shared/src/schemas.ts vytvoř Zod schémata pro Task (name, status enum, tags array, due date, timeline object, owner array, description, subtasks jako JSON string, dependsOn array of IDs). V packages/api vytvoř src/routes/tasks.ts s CRUD operacemi: GET /api/tasks (s query params: search, tags), POST /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id, DELETE /api/tasks/:id. Každý endpoint používá auth middleware a Zod validaci.`
- **Technologie/nástroje**: Zod 3.x, packages/shared workspace

---

### 1.6 Rate limiting middleware

- **Popis**: Rate limiting 120 požadavků za 60 sekund per IP, s custom error zprávami.
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1
- **Výstup**: Rate limiting aktivní na všech `/api/*` routách
- **Testy/Revize**: Po 120 požadavcích za minutu vrátí 429 Too Many Requests
- **Claude Code zadání**: `Nakonfiguruj @fastify/rate-limit plugin: max 120 req za 60s, keyGenerator podle IP (respektuj X-Forwarded-For za Traefikem), custom errorMessage v JSON formátu s retry-after hodnotou. Přidaj rate limit headers do response.`
- **Technologie/nástroje**: @fastify/rate-limit

---

### 1.7 CORS + security headers

- **Popis**: CORS omezení pouze na povolené originy, Helmet security headers, CSP politika.
- **Kdo**: `[Claude]`
- **Vstup**: Fastify projekt z 1.1
- **Výstup**: CORS a security headers aktivní
- **Testy/Revize**: Request z nepovolené domény vrátí CORS chybu; headers obsahují CSP, HSTS, X-Frame-Options
- **Claude Code zadání**: `Nakonfiguruj @fastify/cors: origin povoleno pouze pro FRONTEND_URL env proměnnou (v dev http://localhost:5173), credentials: true. Nakonfiguruj @fastify/helmet s CSP politikou (default-src 'self', script-src 'self', style-src 'self' 'unsafe-inline'). Přidej HSTS header pro produkci.`
- **Technologie/nástroje**: @fastify/cors, @fastify/helmet

---

## FÁZE 2: Testy backendu (Test-first přístup)

### 2.1 Unit testy (Vitest) – services, validators

- **Popis**: Unit testy pro NotionService, Zod validátory, šifrovací funkce a auth helpery.
- **Kdo**: `[Claude]`
- **Vstup**: Backend kód z Fáze 1
- **Výstup**: `packages/api/src/**/*.test.ts`, pokrytí >80%
- **Testy/Revize**: `npm run test` projde; coverage report >80%
- **Claude Code zadání**: `Vytvoř unit testy (Vitest) pro: NotionService.validateDatabase (mock @notionhq/client), Zod schémata (platné/neplatné vstupy), šifrování/dešifrování Notion tokenu, JWT generování a validaci. Použij vi.mock pro external závislosti. Nastav vitest.config.ts s coverage reportem.`
- **Technologie/nástroje**: Vitest 1.x, @vitest/coverage-v8

---

### 2.2 Integration testy – API endpoints

- **Popis**: Integrace testy spouštějící skutečný Fastify server s testovací SQLite DB.
- **Kdo**: `[Claude]`
- **Vstup**: Unit testy z 2.1
- **Výstup**: Testy pro všechny API endpointy včetně auth flow
- **Testy/Revize**: `npm run test:integration` projde se skutečnými HTTP požadavky
- **Claude Code zadání**: `Vytvoř integration testy pro API: auth flow (mock Google OAuth), task CRUD operace (mock Notion API), rate limiting (ověř 429 po překročení limitu), setup wizard validace. Použij fastify.inject() pro HTTP testy bez skutečného síťového spojení. Každý test izoluj s čistou in-memory SQLite.`
- **Technologie/nástroje**: Vitest, fastify.inject()

---

### 2.3 E2E API testy

- **Popis**: End-to-end testy skutečného běžícího serveru simulující kompletní uživatelský flow.
- **Kdo**: `[Claude]`
- **Vstup**: Integration testy z 2.2
- **Výstup**: E2E test suite pro kritické cesty
- **Testy/Revize**: `npm run test:e2e` projde proti lokálně běžícímu serveru
- **Claude Code zadání**: `Vytvoř E2E testy: kompletní flow přihlášení → setup wizard → vytvoření úkolu → editace → smazání. Použij supertest nebo undici pro HTTP klienta. Nastav testovací environment s proměnnými pro Notion sandbox (nebo full mock).`
- **Technologie/nástroje**: supertest, undici

---

## FÁZE 3: Frontend Web (React + Vite)

### 3.1 Projekt setup, Tailwind CSS, Shadcn/ui

- **Popis**: Inicializace React + Vite + TypeScript projektu s Tailwind CSS a Shadcn/ui komponentami.
- **Kdo**: `[Claude]`
- **Vstup**: Monorepo struktura z 0.2
- **Výstup**: Fungující Vite dev server s Tailwind, Shadcn/ui komponenty dostupné
- **Testy/Revize**: `npm run dev` zobrazí landing page; Shadcn Button komponenta se renderuje
- **Claude Code zadání**: `V packages/web inicializuj Vite React TypeScript projekt. Nastav Tailwind CSS v4, přidej shadcn/ui (init s New York style, zinc barvy). Nakonfiguruj path aliasy (@/ → src/). Přidej základní layout: App.tsx s React Router (react-router-dom v6), stránky: LoginPage, SetupPage, DashboardPage. Přidej Poppins font přes Google Fonts.`
- **Technologie/nástroje**: Vite 5.x, React 18, Tailwind CSS 4.x, Shadcn/ui, React Router 6.x

---

### 3.2 Auth flow (Google OAuth redirect, session management)

- **Popis**: Frontend auth: přesměrování na backend OAuth, zpracování callbacku, persitence session, protected routes.
- **Kdo**: `[Claude]`
- **Vstup**: Backend auth endpointy z 1.3, Vite setup z 3.1
- **Výstup**: Funkční přihlášení přes Google, protected routes, auto-logout při expiraci
- **Testy/Revize**: Nepřihlášený uživatel přesměrován na login; přihlášený vidí dashboard
- **Claude Code zadání**: `Vytvoř src/hooks/useAuth.ts (React Query dotaz na /auth/me, logout funkce), src/components/ProtectedRoute.tsx, LoginPage s Google přihlášení tlačítkem (přesměruje na backend /auth/google). Ošetři loading state, chybové stavy, automatické přesměrování po přihlášení.`
- **Technologie/nástroje**: React Query (TanStack Query) 5.x, React Router

---

### 3.3 Setup wizard UI

- **Popis**: Vícekrokový průvodce pro zadání Notion integration tokenu a Database ID s validací a maskováním tokenu.
- **Kdo**: `[Claude]`
- **Vstup**: Auth flow z 3.2
- **Výstup**: SetupPage s 3 kroky: intro, zadání credentials, potvrzení
- **Testy/Revize**: Neplatný token zobrazí chybovou zprávu; platný token zobrazí seznam validovaných sloupců
- **Claude Code zadání**: `Vytvoř src/pages/SetupPage.tsx: krok 1 (instrukce jak vytvořit Notion integration), krok 2 (input pro token s maskováním – zobraz jen prefix 'secret_XXXX...', input pro DB ID), krok 3 (výsledek validace – seznam sloupců se zelenými/červenými ikonami). Po úspěchu přesměruj na dashboard. Použij Shadcn/ui Card, Input, Button, Alert komponenty.`
- **Technologie/nástroje**: Shadcn/ui, React Hook Form, Zod

---

### 3.4 Task store (Zustand) + API hooks (React Query)

- **Popis**: Globální stav úkolů v Zustand, API hooks s optimistickými aktualizacemi, auto-refresh každých 30s.
- **Kdo**: `[Claude]`
- **Vstup**: CRUD API z 1.5
- **Výstup**: `src/store/taskStore.ts`, `src/hooks/useTasks.ts`, optimistické UI aktualizace
- **Testy/Revize**: Vytvoření úkolu se okamžitě zobrazí (optimistický update); při chybě se rollbackne
- **Claude Code zadání**: `Vytvoř Zustand store pro UI state (aktivní view, otevřený modal, filtry). Vytvoř React Query hooks: useTasksQuery (refetchInterval: 30000, staleTime: 25000), useCreateTask (mutace s optimistickým update – onMutate přidá task s temp ID, onError rollback, onSettled invalidate), useUpdateTask, useDeleteTask. Vytvoř src/api/client.ts (fetch wrapper s credentials: 'include', error handling).`
- **Technologie/nástroje**: Zustand 4.x, TanStack Query 5.x

---

### 3.5 Kanban board view (react-dnd)

- **Popis**: Kanban board s sloupci pro každý status (Todo, In Progress, Review, Done), drag & drop přesun mezi sloupci.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/KanbanView.tsx`, funkční drag & drop s optimistickým přesunem
- **Testy/Revize**: Přetažení karty aktualizuje status; vizuálně odpovídá drop zóna
- **Claude Code zadání**: `Vytvoř KanbanView komponentu: 4 sloupce (Todo/In Progress/Review/Done) s @dnd-kit/core a @dnd-kit/sortable. Každá karta (TaskCard) zobrazuje: název, tagy (barevné badges), due date (červená pokud po termínu), avatar ownera. Drop target zvýrazní sloupec. Po dropu zavolej useUpdateTask s novým statusem. Sloupce mají počítadlo úkolů v headeru.`
- **Technologie/nástroje**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

---

### 3.6 Timeline/Gantt view

- **Popis**: Gantt chart s horizontální časovou osou, přetahovatelné a roztahovatelné úkoly, kreslení závislostí.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/TimelineView.tsx` s plně funkčním Gantt chartem
- **Testy/Revize**: Úkoly se zobrazují ve správné časové pozici; drag posune timeline; resize změní délku
- **Claude Code zadání**: `Vytvoř TimelineView s SVG/Canvas přístupem: horizontální osa (dny/týdny, zoom přepínatelný), řádky pro každý úkol, barevné bary odpovídající Timeline datu. Implementuj drag pro přesun (změní start+end datum), resize handle vpravo pro změnu end data. Závislosti nakresli jako šipky mezi bary. Použij interní výpočet pixelů na den. Přidej dnes zvýrazněnou vertikální linku.`
- **Technologie/nástroje**: React + SVG (nativní), případně @visx/xychart pro pomocné utility

---

### 3.7 Calendar view

- **Popis**: Měsíční kalendářní zobrazení s kliknutím pro vytvoření úkolu a drag & drop pro přesunutí na jiný den.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/views/CalendarView.tsx`
- **Testy/Revize**: Úkoly se zobrazují na správných dnech; klik na prázdný den otevře modal s předvyplněným datem
- **Claude Code zadání**: `Vytvoř CalendarView: mřížka 7×6 dnů, navigace měsíc vpřed/vzad, úkoly zobrazeny jako barevné piluky na příslušných dnech (podle due date). Klik na den → otevře CreateTaskModal s předvyplněným due date. Drag úkolu na jiný den → optimistický update due date. Dnes zvýrazněn kruhem.`
- **Technologie/nástroje**: @dnd-kit/core, date-fns

---

### 3.8 Task detail modal (podúkoly, závislosti)

- **Popis**: Modální okno pro zobrazení a editaci kompletního detailu úkolu včetně podúkolů a závislostí.
- **Kdo**: `[Claude]`
- **Vstup**: Task store, Shadcn/ui z 3.1
- **Výstup**: `src/components/TaskDetailModal.tsx`
- **Testy/Revize**: Všechna pole editovatelná; podúkoly lze přidat/zaškrtnout/smazat; závislosti zobrazeny jako linky
- **Claude Code zadání**: `Vytvoř TaskDetailModal (Shadcn Dialog): sekce pro každé pole (název inline edit, status Select, tags MultiSelect, due date DatePicker, owner zobrazení avatarů, description Textarea). Subtasks: JSON parse pole, zobrazit jako checklist s add/remove funkcí. DependsOn: Combobox pro vyhledání a přidání dalších úkolů. Optimistické ukládání při každé změně (debounce 500ms).`
- **Technologie/nástroje**: Shadcn/ui Dialog, Select, Calendar komponenty, date-fns

---

### 3.9 Search + filter UI

- **Popis**: Fulltextové vyhledávání podle názvu úkolu a filtrování podle tagů.
- **Kdo**: `[Claude]`
- **Vstup**: Task store z 3.4
- **Výstup**: `src/components/SearchBar.tsx`, `src/components/TagFilter.tsx`
- **Testy/Revize**: Zadání textu filtruje viditelné úkoly; výběr tagu zobrazí jen úkoly s tímto tagem
- **Claude Code zadání**: `Vytvoř SearchBar komponentu: input s debounce 300ms, ukládá search query do Zustand store. TagFilter: zobrazí všechny unikátní tagy z úkolů jako kliknutelné badges (toggle aktivní/neaktivní), ukládá aktivní tagy do store. Filtrace probíhá client-side v Zustand selektoru. Přidej tlačítko pro reset filtrů.`
- **Technologie/nástroje**: Zustand selektory, use-debounce

---

### 3.10 Keyboard shortcuts

- **Popis**: Klávesové zkratky: 1/2/3 pro přepínání pohledů, Escape pro zavření modálů.
- **Kdo**: `[Claude]`
- **Vstup**: Veškerý frontend z 3.1–3.9
- **Výstup**: `src/hooks/useKeyboardShortcuts.ts`
- **Testy/Revize**: Stisk 1 přepne na Kanban; Escape zavře otevřený modal
- **Claude Code zadání**: `Vytvoř useKeyboardShortcuts hook s useEffect na window keydown event: klávesy 1/2/3 přepínají activeView v Zustand store (kanban/timeline/calendar), Escape nastaví openModal na null v store. Ignoruj zkratky pokud je focus v input/textarea elementu. Přidej vizuální nápovědu (tooltip nebo help panel s ? klávesou).`
- **Technologie/nástroje**: React hooks, Zustand

---

## FÁZE 4: Testy frontendu

### 4.1 Unit testy komponent (Vitest + Testing Library)

- **Popis**: Unit testy React komponent s mockováním API volání.
- **Kdo**: `[Claude]`
- **Vstup**: Frontend kód z Fáze 3
- **Výstup**: Testy pro klíčové komponenty, pokrytí >70%
- **Testy/Revize**: `npm run test` projde; komponenty renderují správně pro různé stavy
- **Claude Code zadání**: `Vytvoř testy (Vitest + @testing-library/react): TaskCard (renderuje název, status, tagy), KanbanView (správný počet sloupců), SearchBar (debounce filtrování), TaskDetailModal (validace formuláře). Mockuj React Query pomocí msw (Mock Service Worker) pro API odpovědi.`
- **Technologie/nástroje**: Vitest, @testing-library/react, msw 2.x

---

### 4.2 Playwright E2E testy

- **Popis**: Klikací E2E testy v Chromium prohlížeči simulující reálné uživatelské scénáře.
- **Kdo**: `[Claude]`
- **Vstup**: Běžící frontend + backend (lokálně nebo CI)
- **Výstup**: `packages/web/e2e/*.spec.ts`
- **Testy/Revize**: `npm run test:e2e` projde; screenshoty při chybě uloženy
- **Claude Code zadání**: `Vytvoř Playwright testy: login flow (mock OAuth), setup wizard (zadání credentials, zobrazení validace), vytvoření úkolu v Kanban view, přesun mezi sloupci drag&drop (pomocí page.dragAndDrop), otevření detailu úkolu. Nastav playwright.config.ts s baseURL, screenshots on failure, video recording.`
- **Technologie/nástroje**: Playwright 1.x

---

### 4.3 Visual regression testy

- **Popis**: Screenshot testy pro zachycení nechtěných vizuálních změn v UI.
- **Kdo**: `[Claude]`
- **Vstup**: E2E testy z 4.2
- **Výstup**: Baseline screenshots, automatické porovnání v CI
- **Testy/Revize**: Při změně UI komponenty test selže a zobrazí diff screenshot
- **Claude Code zadání**: `Přidej Playwright visual regression testy pomocí expect(page).toHaveScreenshot(): snímky pro KanbanView (prázdný stav, s úkoly), TaskDetailModal, CalendarView (prázdný měsíc). Nastav threshold 0.1% pro pixel diff. Přidej --update-snapshots flag do npm skriptu.`
- **Technologie/nástroje**: Playwright toHaveScreenshot()

---

## FÁZE 5: iOS (SwiftUI)

### 5.1 Xcode projekt setup, architektura (MVVM)

- **Popis**: Inicializace Xcode projektu s MVVM architekturou, targets pro app a testy.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Mac s Xcode 15+
- **Výstup**: Xcode projekt v `packages/ios/`, MVVM folder struktura
- **Testy/Revize**: Build a spuštění na iOS Simulator (iPhone 15, iOS 17)
- **Claude Code zadání**: `Vytvoř packages/ios/ se strukturou: Models/, ViewModels/, Views/, Services/, Components/. Přidej základní App.swift, ContentView.swift, a AppRouter pro navigaci. Nastav SwiftLint konfiguraci.`
- **Manuální kroky**: Otevři Xcode → New Project → iOS App → NotionTodoApp, uložení do packages/ios/
- **Technologie/nástroje**: Xcode 15, Swift 5.9, SwiftUI, SwiftLint

---

### 5.2 Network layer (URLSession + async/await)

- **Popis**: Swift síťová vrstva pro komunikaci s backend API s async/await, error handling a automatickým retry.
- **Kdo**: `[Claude]`
- **Vstup**: Xcode projekt z 5.1
- **Výstup**: `Services/APIClient.swift` s metodami pro všechny endpointy
- **Testy/Revize**: Unit test mockující URLSession vrátí správné modely
- **Claude Code zadání**: `Vytvoř APIClient.swift jako actor s generickou request<T: Decodable> metodou. Ošetři: automatické přidání cookies (HTTPCookieStorage), JSON decode/encode, error typy (APIError enum: unauthorized, notFound, serverError, networkError). Přidej endpoint metody: getTasks(), createTask(), updateTask(), deleteTask(), validateNotion().`
- **Technologie/nástroje**: URLSession, Swift Concurrency (async/await), Combine (pro reactive binding)

---

### 5.3 Auth flow (Google Sign-In SDK)

- **Popis**: Google přihlášení na iOS s Google Sign-In SDK, uložení session cookie, auto-refresh.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Google Cloud Console iOS client ID (manuální)
- **Výstup**: Funkční přihlášení, session persistována v Keychain
- **Testy/Revize**: Přihlášení zobrazí Google sheet; po přihlášení se zobrazí dashboard
- **Claude Code zadání**: `Implementuj AuthViewModel s @Published currentUser. Přidej Google Sign-In Swift Package (GoogleSignIn-iOS). Po úspěšném Google Sign-In pošli id_token na backend /auth/google/mobile endpoint (nový endpoint), dostaneš JWT cookie. Ulož cookie do HTTPCookieStorage. Přidej Keychain wrapper pro persistenci.`
- **Manuální kroky**: V Google Cloud Console přidej iOS OAuth client s Bundle ID tvé aplikace
- **Technologie/nástroje**: GoogleSignIn Swift Package, Security framework (Keychain)

---

### 5.4 Kanban view (SwiftUI)

- **Popis**: Nativní SwiftUI implementace Kanban boardu s velkými tap targets a swipe gesturami.
- **Kdo**: `[Claude]`
- **Vstup**: APIClient z 5.2
- **Výstup**: `Views/KanbanView.swift`
- **Testy/Revize**: Úkoly zobrazeny ve správných sloupcích; swipe pro rychlou změnu statusu
- **Claude Code zadání**: `Vytvoř KanbanView: horizontální ScrollView se 4 sloupci (LazyHStack), každý sloupec je vertikální seznam (LazyVStack) TaskCard komponent. TaskCard: min výška 80pt, tap otevře detail sheet. Swipe right → "In Progress", swipe left → "Done". Přidej pull-to-refresh (refreshable modifier).`
- **Technologie/nástroje**: SwiftUI, ScrollView, gestures

---

### 5.5 Timeline view (SwiftUI Canvas)

- **Popis**: Gantt chart implementovaný pomocí SwiftUI Canvas pro výkonné renderování.
- **Kdo**: `[Claude]`
- **Vstup**: Task modely z 5.2
- **Výstup**: `Views/TimelineView.swift`
- **Testy/Revize**: Úkoly renderovány ve správných časových pozicích; pinch-to-zoom mění měřítko
- **Claude Code zadání**: `Vytvoř TimelineView s Canvas { context, size } renderováním: kreslení řádků, barevných barů pro každý úkol (timeline datum), dnes čára. Přidej DragGesture pro posun view. MagnificationGesture pro zoom (dny/týdny přepínání). Tap na bar otevře detail sheet. Optimalizuj pro 60fps.`
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

- **Popis**: Native detail view pro úkol s editací všech polí a checklistem podúkolů.
- **Kdo**: `[Claude]`
- **Vstup**: APIClient z 5.2
- **Výstup**: `Views/TaskDetailView.swift`
- **Testy/Revize**: Editace pole uloží změnu; podúkol lze zaškrtnout; závislosti zobrazeny
- **Claude Code zadání**: `Vytvoř TaskDetailView jako Form: TextField pro název, Picker pro status, MultiPicker pro tagy, DatePicker pro due date, sekce Subtasks (List s Toggle pro každý podúkol, swipe to delete, add button). Přidej debounce ukládání (0.5s po změně). NavigationLink pro závislé úkoly.`
- **Technologie/nástroje**: SwiftUI Form, Combine debounce

---

### 5.8 Push notifikace (APNs)

- **Popis**: Push notifikace pro blížící se termíny úkolů přes Apple Push Notification service.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Apple Developer Account
- **Výstup**: Registrace APNs, backend endpoint pro odeslání notifikace, scheduler
- **Testy/Revize**: Testovací notifikace dorazí na zařízení
- **Claude Code zadání**: `V iOS app: requestAuthorization pro notifikace, registrace pro remote notifications, odeslání device tokenu na backend POST /api/notifications/register. V backendu: uložení device tokenů do SQLite, node-apn nebo @parse/node-apn pro odesílání, cron job každou hodinu kontrolující úkoly s due date za 24h.`
- **Manuální kroky**: V Apple Developer Portal vytvoř APNs klíč (.p8 soubor) a přidej ho jako GitHub Secret
- **Technologie/nástroje**: UserNotifications framework, node-apn, node-cron

---

### 5.9 Offline support (Core Data cache)

- **Popis**: Lokální cache úkolů v Core Data pro offline zobrazení a read-only fungování bez internetu.
- **Kdo**: `[Claude]`
- **Vstup**: Task modely a APIClient z 5.2
- **Výstup**: Core Data model, sync logika při obnovení připojení
- **Testy/Revize**: Vypnutí Wi-Fi → úkoly stále viditelné; zapnutí Wi-Fi → sync s API
- **Claude Code zadání**: `Vytvoř Core Data model TaskEntity s odpovídajícími atributy. Vytvoř PersistenceController singleton. Uprav APIClient: po každém úspěšném fetch ulož do Core Data. Při chybě sítě (URLError.notConnectedToInternet) načti z Core Data. Přidej NWPathMonitor pro detekci obnovení spojení a automatický sync.`
- **Technologie/nástroje**: Core Data, Network framework (NWPathMonitor)

---

### 5.10 XCTest unit + UI testy

- **Popis**: Unit testy ViewModelů a UI testy kritických flows.
- **Kdo**: `[Claude]`
- **Vstup**: iOS kód z 5.1–5.9
- **Výstup**: XCTest test suite
- **Testy/Revize**: `CMD+U` v Xcode projde všechny testy
- **Claude Code zadání**: `Vytvoř XCTest unit testy pro: APIClient (mock URLSession s URLProtocol), TaskViewModel (mock APIClient, test filtrace a řazení), AuthViewModel (mock Google Sign-In). Přidej XCUITest UI testy pro: login flow, zobrazení kanban boardu, vytvoření úkolu.`
- **Technologie/nástroje**: XCTest, XCUITest, URLProtocol mocking

---

## FÁZE 6: Bezpečnostní audit

### 6.1 OWASP Top 10 kontrola

- **Popis**: Systematická kontrola nejčastějších bezpečnostních zranitelností dle OWASP Top 10 2021.
- **Kdo**: `[Claude]`
- **Vstup**: Kompletní kód z Fází 1–5
- **Výstup**: Bezpečnostní report, opravené zranitelnosti
- **Testy/Revize**: Žádná kritická ani vysoká zranitelnost v reportu
- **Claude Code zadání**: `Proveď code review zaměřený na OWASP Top 10: A01 Broken Access Control (ověř že každý endpoint kontroluje autentizaci a autorizaci), A02 Cryptographic Failures (ověř AES-256 pro Notion token, HTTPS everywhere), A03 Injection (ověř Zod validaci všech vstupů, parametrizované SQLite dotazy), A05 Security Misconfiguration (zkontroluj CORS, headers), A07 Auth failures (ověř JWT expiraci, HTTPOnly cookies). Vytvoř security-report.md se zjištěními.`
- **Technologie/nástroje**: Manuální code review, OWASP checklist

---

### 6.2 Dependency audit

- **Popis**: Audit npm a Swift závislostí pro known vulnerabilities.
- **Kdo**: `[Claude]`
- **Vstup**: package.json soubory, Package.swift
- **Výstup**: Opravené zranitelné závislosti
- **Testy/Revize**: `npm audit` vrátí 0 high/critical; Xcode dependency audit čistý
- **Claude Code zadání**: `Spusť npm audit --audit-level=moderate pro každý package. Pro kritické: upgraduj nebo nahraď závislost. Přidej npm audit do CI pipeline (krok před build). Nastav Dependabot v .github/dependabot.yml pro automatické PR s aktualizacemi.`
- **Technologie/nástroje**: npm audit, GitHub Dependabot

---

### 6.3 Secret scanning

- **Popis**: Kontrola že žádné secrets nejsou v kódu nebo Git historii.
- **Kdo**: `[Claude]`
- **Vstup**: Git repozitář
- **Výstup**: Čistá Git historie bez secrets, gitleaks v CI
- **Testy/Revize**: gitleaks scan vrátí 0 nalezených secrets
- **Claude Code zadání**: `Přidej gitleaks do CI pipeline jako první krok. Vytvoř .gitleaks.toml s konfigurací (allow list pro testovací hodnoty). Zkontroluj celou Git historii: gitleaks detect --source . --log-opts="--all". Přidej pre-commit hook pro lokální kontrolu.`
- **Technologie/nástroje**: gitleaks, git-secrets

---

### 6.4 Penetration testing checklist

- **Popis**: Manuální penetrační testování klíčových bezpečnostních aspektů.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Staging prostředí běžící na VPS
- **Výstup**: Penetrační test report
- **Testy/Revize**: Žádná kritická zranitelnost nenalezena
- **Claude Code zadání**: `Vytvoř penetration-testing-checklist.md: seznam testů pro: SQL injection přes API parametry, XSS přes task název/popis, CSRF (ověř SameSite cookie), brute force (ověř rate limiting), JWT manipulation (změna alg na none), IDOR (přístup k úkolům jiného uživatele), open redirect v OAuth flow.`
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
  2. Vytvoř `/opt/notionapp/.env` s produkčními hodnotami (nikdy do Gitu!)
  3. Nastav logrotate: `nano /etc/logrotate.d/notionapp`
  4. Nastav automatické bezpečnostní aktualizace: `apt install unattended-upgrades && dpkg-reconfigure unattended-upgrades`

---

### 7.2 Docker production build

- **Popis**: Optimalizované multi-stage Docker images pro produkci.
- **Kdo**: `[Claude]`
- **Vstup**: Aplikační kód z Fází 1–3
- **Výstup**: `packages/api/Dockerfile`, `packages/web/Dockerfile` (multi-stage)
- **Testy/Revize**: `docker build` projde; výsledný image < 150MB
- **Claude Code zadání**: `Vytvoř multi-stage Dockerfile pro api: stage 1 (node:20-alpine AS builder) npm ci + tsup build, stage 2 (node:20-alpine) zkopíruj jen dist/ a node_modules --production, non-root user 'app', HEALTHCHECK. Pro web: stage 1 npm ci + vite build, stage 2 (nginx:alpine) zkopíruj dist/, nginx.conf s SPA fallback a gzip kompresí. Optimalizuj .dockerignore.`
- **Technologie/nástroje**: Docker multi-stage, nginx:alpine

---

### 7.3 GitHub Actions deploy workflow

- **Popis**: Automatický deploy při merge do main: build → push do GHCR → SSH deploy na VPS.
- **Kdo**: `[Claude]`
- **Vstup**: GitHub Secrets z 0.7, Docker images z 7.2
- **Výstup**: `.github/workflows/deploy.yml` s kompletním deploy pipeline
- **Testy/Revize**: Merge do main spustí deploy; aplikace dostupná na doméně do 5 minut
- **Claude Code zadání**: `Aktualizuj deploy.yml: krok 1 login do GHCR (docker/login-action), krok 2 build a push obou images s tagem sha-${{ github.sha }} a latest, krok 3 SSH na VPS (appleboy/ssh-action): docker pull nových images, docker compose down, docker compose up -d, docker system prune -f. Přidej smoke test krok: curl healthcheck endpoint.`
- **Technologie/nástroje**: GitHub Actions, GHCR, appleboy/ssh-action

---

### 7.4 Monitoring + alerting

- **Popis**: Uptime monitoring a alerting při výpadku aplikace.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Běžící produkce z 7.3
- **Výstup**: Uptime Kuma dashboard, notifikace na email/Slack
- **Claude Code zadání**: `Přidej Uptime Kuma do infra/docker-compose.yml (louislam/uptime-kuma:1). Přidej /health endpoint do Fastify API vracející JSON {status: "ok", uptime: process.uptime(), db: "connected"}. Vytvoř monitoring docker compose override.`
- **Manuální kroky**: Přistup na Uptime Kuma UI (:3001), přidej monitor pro API /health a web URL, nastav email notifikace
- **Technologie/nástroje**: Uptime Kuma, Fastify health endpoint

---

### 7.5 Backup strategie

- **Popis**: Automatické zálohy SQLite databáze na vzdálené úložiště.
- **Kdo**: `[Claude+Uživatel]`
- **Vstup**: Produkční VPS
- **Výstup**: Cron job pro denní zálohy, zálohy v Backblaze B2 nebo AWS S3
- **Claude Code zadání**: `Vytvoř backup.sh skript: SQLite .backup příkaz do timestampovaného souboru, komprimuj gzip, nahraj do B2/S3 přes rclone nebo aws cli, smaž zálohy starší 30 dní. Přidej do /etc/cron.d/ pro spouštění každý den v 3:00.`
- **Manuální kroky**: Vytvoř Backblaze B2 bucket, nastav rclone konfiguraci na VPS, otestuj manuální zálohu
- **Technologie/nástroje**: SQLite .backup, rclone, cron

---

## FÁZE 8: Finální revize

### 8.1 Senior developer review checklist

- **Popis**: Kódový review zaměřený na architekturu, výkon a udržovatelnost.
- **Kdo**: `[Claude]`
- **Vstup**: Kompletní kódová báze
- **Výstup**: Review report s doporučeními
- **Claude Code zadání**: `Proveď senior code review a zkontroluj: správné error handling (žádné unhandled promises, Swift error propagace), konzistentní naming conventions, DRY princip (žádná duplicita logiky), výkon (N+1 queries v Notion API, memoizace v Reactu), TypeScript typy (žádné any, správné generiky), testovatelnost (dependency injection). Vytvoř review komentáře přímo v kódu jako TODO/FIXME.`

---

### 8.2 Security expert review checklist

- **Popis**: Finální bezpečnostní kontrola před produkčním spuštěním.
- **Kdo**: `[Claude]`
- **Vstup**: Kód z Fáze 6 + finální verze
- **Výstup**: Security signoff dokument
- **Claude Code zadání**: `Ověř finální stav: HTTPOnly cookie nastavena správně v produkci (Secure flag), Notion tokeny nikdy nelogovány (zkontroluj Pino logger konfiguraci pro redakci), rate limiting funguje za Traefikem (správný X-Forwarded-For), SQLite soubor mimo webroot, Docker container běží jako non-root, env soubory v .gitignore.`

---

### 8.3 UI/UX kritický review checklist

- **Popis**: Kontrola uživatelského zážitku, přístupnosti a responsivity.
- **Kdo**: `[Claude]`
- **Vstup**: Běžící frontend aplikace
- **Výstup**: Seznam UX problémů k opravě
- **Claude Code zadání**: `Zkontroluj UI: loading states (skeleton loaders místo spinnerů kde možné), error states (user-friendly zprávy, ne raw error objekty), empty states (prázdný kanban board má CTA pro vytvoření prvního úkolu), keyboard navigace (Tab pořadí dává smysl, focus visible), responsivita (funkční na 1280px i 1920px), dark mode podpora (Tailwind dark: třídy), přístupnost (aria-label na ikonových tlačítkách, role atributy).`

---

### 8.4 Performance audit

- **Popis**: Výkonnostní audit webové aplikace a API response časů.
- **Kdo**: `[Claude]`
- **Vstup**: Produkční nebo staging prostředí
- **Výstup**: Lighthouse report > 90, API latence < 200ms
- **Claude Code zadání**: `Spusť Lighthouse CI audit (přidej do CI jako volitelný krok). Zkontroluj: bundle size (vite-bundle-analyzer – žádný chunk > 500KB), lazy loading pro Timeline a Calendar view (React.lazy + Suspense), API response caching headers, komprese gzip v nginx, SQLite WAL mode aktivní, Notion API volání s timeoutem 10s.`
- **Technologie/nástroje**: Lighthouse CI, vite-bundle-analyzer, k6 pro load testing

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
3. Fáze 3 (3.1–3.5 – jen Kanban view)
4. Fáze 7 (7.1–7.3)

**Full Feature – zbývající 2–3 týdny:**
- Timeline + Calendar view (3.6, 3.7)
- Task detail plně funkční (3.8, 3.9, 3.10)
- Testy (Fáze 2, 4)
- iOS app (Fáze 5)
- Bezpečnostní audit (Fáze 6)
- Monitoring + backup (7.4, 7.5)
- Finální revize (Fáze 8)

---

### Rizika a mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|-----------------|-------|----------|
| Notion API rate limiting (3 req/s) | Vysoká | Střední | Implementuj request queue s exponential backoff; cache responses 30s |
| Google OAuth credentials expired/revoked | Nízká | Vysoký | Monitoring platnosti, upozornění přes email |
| SQLite concurrency issues při mnoha uživatelích | Střední | Střední | WAL mode, connection pooling, uvažuj o migraci na PostgreSQL při škálování |
| iOS App Store review zamítnutí | Střední | Vysoký | Dodržuj HIG guidelines, testuj na reálném zařízení před odesláním, připrav review notes |
| Notion API breaking changes | Nízká | Vysoký | Pinuj verzi @notionhq/client, sleduj Notion changelog, integrace testy zachytí regresi |
| VPS výpadek | Nízká | Vysoký | Uptime Kuma alerting, manuální restart procedura dokumentována, zvažuj 2 VPS s failover |
| JWT secret kompromitace | Velmi nízká | Kritický | Rotace JWT secret = invalidace všech sessions (akceptovatelné), Keychain na iOS pro bezpečné ukládání |
| Únos Google OAuth callback (redirect URI manipulation) | Nízká | Kritický | Whitelist redirect URIs v Google Console, validuj state parametr, PKCE flow |
