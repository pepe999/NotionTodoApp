# Bezpečnostní report (Fáze 6)

Datum: 2026-06-06 · Rozsah: backend (`packages/api`), web (`packages/web`),
shared, iOS (`packages/ios`). Metoda: manuální code review dle **OWASP Top 10
(2021)** + `npm audit` + secret scan.

**Souhrn: žádný kritický ani vysoký nález.** Bezpečnostní kontroly zavedené už
během Fází 1–5 (a revize plánu v PR #2/#3) byly ověřeny proti kódu.

| Oblast | Stav |
|--------|------|
| A01 Broken Access Control | ✅ |
| A02 Cryptographic Failures | ✅ |
| A03 Injection | ✅ |
| A04 Insecure Design | ✅ |
| A05 Security Misconfiguration | ✅ |
| A06 Vulnerable Components | ✅ `npm audit` = 0 |
| A07 Identification & Auth Failures | ✅ |
| A08 Software & Data Integrity | ✅ |
| A09 Logging & Monitoring | ✅ |
| A10 SSRF | ✅ |

---

## A01 – Broken Access Control
- Všechny `/api/*` routy mají `preHandler: [app.authenticate, apiRateLimit]`
  (`routes/tasks.ts`, `setup.ts`, `account.ts`, `notifications.ts`); `/auth/me`
  má `app.authenticate`.
- `authenticate` ověří JWT i existenci session v DB (`auth/service.ts` →
  `resolveSession`), takže odhlášená/expirovaná session je okamžitě neplatná.
- **IDOR / cross-user data**: úkoly se čtou/píší výhradně přes Notion token a
  databázi **přihlášeného uživatele** (`getDecryptedNotionConfig(db, cipher,
  req.user.id)` v `loadNotionContext`). Uživatel nemá jak sáhnout na data jiného
  uživatele – cizí `taskId` by se posílalo do *jeho vlastní* Notion DB.
- GDPR `DELETE /api/account` maže jen `req.user.id`; `ON DELETE CASCADE` odstraní
  sessions/notion_configs/device_tokens.

## A02 – Cryptographic Failures
- Notion token: **AES-256-GCM** s náhodným 12B IV na každý zápis, IV + auth tag
  uloženy zvlášť, `key_version` pro rotaci (`crypto/tokenCrypto.ts`, migrace 001).
- Session cookie: `HttpOnly`, `Secure` v produkci, `SameSite=Lax`
  (`auth/cookies.ts`). V DB jen SHA-256 hash opaque tokenu, nikdy plaintext.
- HSTS (2 roky, includeSubDomains, preload) v produkci (`server.ts`).
- JWT podpis HS256 se silným `JWT_SECRET` (min. 32 znaků, validováno v `env.ts`).

## A03 – Injection
- **SQL**: výhradně `better-sqlite3` prepared statements s `?` placeholdery –
  žádná string-konkatenace (ověřeno `git grep`).
- **Vstupy**: Zod validace na hranicích (`@notiontodoapp/shared` + `.parse` v
  routách), Ajv JSON schema u tasks rout.
- **Notion path injection**: `database_id`/`parent_id`/`taskId` se validují jako
  UUID (`services/notion/ids.ts`) PŘED interpolací do API cesty.

## A04 – Insecure Design
- Dvouúrovňový rate limiting, write-through cache s invalidací, idle+absolutní
  expirace session, rotace session při loginu, least-privilege CI oprávnění.

## A05 – Security Misconfiguration
- CORS jen na `FRONTEND_URL` (nereflektuje origin), `credentials: true`.
- Helmet: CSP (prod, bez `unsafe-inline`), `frame-ancestors 'none'`,
  `object-src 'none'`, Referrer-Policy, Permissions-Policy, CORP same-site.
- Žádný stack trace v produkci (`setErrorHandler` sanitizuje 5xx).
- `/docs` (Swagger) jen mimo produkci; `/metrics` jen s `METRICS_TOKEN`
  (konstantně-časové porovnání), jinak 404.
- DoS limity: `bodyLimit` 256 KB, `connectionTimeout`, `maxParamLength`.

## A06 – Vulnerable & Outdated Components
- `npm audit --audit-level=moderate` = **0 zranitelností** (root i workspaces).
- CI: `npm audit`, CodeQL, Trivy, dependency-review (neblokující na free tieru),
  gitleaks. Přidán **Dependabot** (`.github/dependabot.yml`).

## A07 – Identification & Authentication Failures
- Google OAuth 2.0 Authorization Code + **PKCE (S256)** + CSRF `state`
  (konstantně-časové porovnání). iOS `/auth/mobile` ověřuje `id_token` proti
  Google **JWKS** (iss/aud/exp/email_verified).
- JWT **alg whitelist** `['HS256']` – `alg: none` je odmítnut (`auth/jwt.ts`).
- Logout maže session z DB; brute-force chrání rate limit na `/auth/*` (120/min/IP).

## A08 – Software & Data Integrity Failures
- CI akce připnuté na verze, least-privilege `permissions`, `concurrency`.
- Migrace běží v transakcích, idempotentní (`schema_migrations`).

## A09 – Security Logging & Monitoring Failures
- `audit_log` (login/logout/auth_failed/setup_save/account_export/delete) s IP/UA.
- Pino `redact` pro token/cookie/authorization/**email**/id_token. `/health` +
  `/metrics`. Graceful shutdown.

## A10 – SSRF
- Notion i Google API URL jsou **hardcoded** (`services/notion/client.ts`,
  `auth/google.ts`) – nikdy z user inputu. ID validovány jako UUID.

---

## Nálezy & doporučení (nízká priorita)
1. **dependency-review** na privátním repu vyžaduje GitHub Advanced Security –
   běží jako neblokující; po pořízení GHAS odebrat `continue-on-error`.
2. **Per-task dedup push notifikací** je zatím coarse (per-zařízení/20 h) –
   zvážit jemnější stav při škálování.
3. **Rate-limit store** je in-memory (OK pro 1 instanci) – při horizontálním
   škálování přepnout na Redis.
4. iOS kód nebyl staticky ověřen v CI (chybí Xcode toolchain) – ověřit v Xcode.
