# Finální revize (Fáze 8)

Datum: 2026-06-06 · Rozsah: celá kódová báze (Fáze 1–7). Čtyři pohledy:
senior dev, security signoff, UX/UI, performance. **Závěr: připraveno k nasazení**
(zbývají jen uživatelské kroky mimo kód – viz `docs/deployment.md` a finální TODO).

## 8.1 Senior developer review ✅
- **Error handling**: globální `setErrorHandler` (sanitizace 5xx), routy mají
  `try/catch` + `handleNotionError`; mutace na webu mají `onError` rollback;
  žádné nezachycené promises (`void` u fire-and-forget). iOS `APIError` enum.
- **Naming/DRY**: sdílená Zod schémata v `@notiontodoapp/shared`, sdílený
  `handleNotionError`, `apiFetch` wrapper, `renderWithProviders` v testech.
- **Typy**: TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`); v produkčním kódu žádné `any` (jen ojediněle v testech
  s `as unknown` u mocků). `lint` čistý.
- **Testovatelnost**: dependency injection (NotionService/fetch/queue/cipher
  injektovatelné), in-memory SQLite v testech. **api 153 + web 66 testů**.
- **Hierarchie podúkolů**: `parentId` konzistentně napříč shared typy → Notion
  mapping (`Parent item` relace) → API → web (počty bez N+1) → iOS.
- Drobnost (nízká priorita): `audit_log` ORDER BY používá TEMP B-TREE – při
  velkém objemu zvážit kompozitní index `(user_id, created_at)`.

## 8.2 Security signoff ✅
Navazuje na `docs/security-report.md` (Fáze 6), ověřen finální stav:
- Cookie `HttpOnly` + `Secure` (produkce) + `SameSite=Lax`; Notion token nikdy
  nelogován (Pino `redact` vč. e-mailů/id_token).
- Rate limiting za Traefikem funguje (`trustProxy` = počet hopů → správná
  klientská IP, ne spoofovatelná).
- SQLite v named volume (`/data`), mimo nginx webroot. Docker api běží jako
  **non-root**, `read_only` rootfs, `cap_drop: ALL`, `no-new-privileges`.
- `.env` v `.gitignore` (ověřeno), žádné secrets v repu (gitleaks + `git grep`).
- Logout maže session z SQLite (ověřeno testem). SSRF: Notion/Google URL hardcoded.

## 8.3 UI/UX kritický review ✅
- **Loading**: skeleton loadery na dashboardu (ne jen spinner); Suspense fallback
  pro lazy views.
- **Error**: lokalizované hlášky (sonner toasty), ne raw error; `OfflineBanner`
  s retry; `ErrorBoundary` se smysluplnou hláškou místo bílé stránky.
- **Empty**: prázdný Kanban má CTA „Vytvořit první úkol".
- **Klávesnice/a11y**: focus-visible ringy, focus trap v modálech (Radix),
  `aria-label` na ikon-only tlačítkách, `aria-pressed` u filtrů, aria-live
  announcements u D&D, `prefers-reduced-motion`.
- **Responsivita**: desktop-first; Kanban horizontální scroll funguje na užších
  šířkách. **Dark mode** (light/dark/system + persistence).
- Pozn.: jemné doladění responzivity na tabletu a vizuální QA proběhne při
  ručním ověření v prohlížeči (Playwright visual baseline z 4.3).

## 8.4 Performance audit ✅
- **Lazy loading**: `TimelineView` a `CalendarView` jsou samostatné chunky
  (`React.lazy` + Suspense) – ověřeno v buildu (~2–4 kB každý).
- **Bundle**: hlavní chunk ~518 kB raw / **~146 kB brotli** < rozpočet 250 kB
  (size-limit gate v CI).
- **SQLite**: WAL aktivní, **všechny klíčové dotazy používají index**
  (EXPLAIN QUERY PLAN: `SEARCH … USING INDEX` pro token_hash, expires_at,
  google_id, user_id na všech tabulkách).
- **Notion**: sdílená p-queue (~3 req/s) + write-through per-user cache (TTL 20 s)
  + 429 retry s `Retry-After` (ověřeno testy). Web polling pauzuje na skrytém tabu.
- **nginx**: gzip zapnut, dlouhá cache na hashované assety.
- **Latenční rozpočty**: lokální/cache-hit endpointy cíl p95 < 200 ms; endpointy
  závislé na Notion mají vlastní rozpočet (Notion ~300–800 ms) – klíčový je
  cache-hit ratio a chování fronty při burstu.
- **Load test**: `scripts/load-test.js` (k6) – ověř, že fronta drží ~3 req/s na
  Notion a 429 se retryuje. **Lighthouse CI** (cíl > 90) se spouští ručně proti
  staging (vyžaduje běžící prostředí).

## Otevřené (nízká priorita / mimo kód)
1. Kompozitní index pro audit export (až bude objem).
2. Lighthouse CI + k6 proti živému staging (Fáze 7 prostředí).
3. iOS build ověřit v Xcode (nešlo staticky).
4. `dependency-review` vyžaduje GHAS (neblokující).
