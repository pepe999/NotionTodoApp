# Bezpečnostní a architekturální review – NotionTodoApp

> **Revize provedena**: 2026-06-04  
> **Role**: Senior architekt + bezpečnostní expert  
> **Verze plánu**: Po merge PR #1 (1f21a8a)

---

## Metodika

Provedeny dvě iterace review:

1. **Iterace 1** – Celkový přehled, identifikace všech problémů
2. **Iterace 2** – Hluboký ponor, verifikace problémů a konkrétní opravy

---

## ITERACE 1 – Celkový přehled

### Kritické problémy

| ID | Popis | Status |
|----|-------|--------|
| K1 | OAuth state parametr chybí v implementaci 1.3 (CSRF na OAuth flow) | **Opraveno v PLAN.md** |
| K2 | AES-GCM: statický IV by byl katastrofický – plán nespecifikoval náhodný IV | **Opraveno v PLAN.md** |
| K3 | iOS cookie persistence přes Keychain obchází HTTPOnly ochranu | **Opraveno v PLAN.md** |
| K4 | `/auth/mobile` endpoint nevalidoval Google id_token | **Opraveno v PLAN.md** |

### Vysoké problémy

| ID | Popis | Status |
|----|-------|--------|
| V1 | Chybí PKCE pro OAuth flow | **Opraveno v PLAN.md** |
| V2 | CSP `style-src 'unsafe-inline'` – vysvětleno jako přijatelné pro CSS (ne JS) | Akceptováno s komentářem |
| V3 | `trustProxy: 1` chyběl v Fastify instanci (rate limit bral IP Traefiku) | **Opraveno v PLAN.md** |
| V4 | Vitest 1.x místo aktuálního 2.x | **Opraveno v PLAN.md** |
| V5 | Xcode 15 / Swift 5.9 – zastaralé, Swift 6 má breaking changes | **Opraveno v PLAN.md** |
| V6 | Tailwind CSS v4 + Shadcn/ui kompatibilita není garantována | **Opraveno – přechod na v3** |
| V7 | Backup soubory nebyly šifrovány před uploadem do B2/S3 | **Opraveno v PLAN.md** |

### Střední problémy

| ID | Popis | Status |
|----|-------|--------|
| S1 | `gantt-task-react` – špatně udržovaná knihovna | Poznámka v plánu, výběr na implementátora |
| S2 | Notion API jako primary DB – web nemá offline fallback (iOS má) | Akceptováno – webový offline není v rozsahu MVP |
| S3 | `node-cron` v API procesu – single point of failure pro APNs | Riziko dokumentováno, přijatelné pro MVP |
| S4 | Swagger UI dostupné v produkci (information disclosure) | **Opraveno – podmíněná registrace** |
| S5 | `trustProxy` konfigurace pro rate limit | **Opraveno v PLAN.md** |
| S6 | JWT bez refresh token mechanismu | Akceptováno – sessions v SQLite jako náhrada |
| S7 | Deploy SSH klíč bez omezení příkazů | Poznámka pro uživatele (manuální krok) |

### Nízké problémy

| ID | Popis | Status |
|----|-------|--------|
| N1 | `npm_package_version` v health endpointu | **Opraveno – odstraněno** |
| N2 | Uptime Kuma na stejném hostiteli jako aplikace | Dokumentováno jako known limitation |
| N3 | `curl | sh` pro Docker instalaci | Dokumentováno – standard Dockeru |

---

## ITERACE 2 – Hluboký ponor

### K1 + V1: OAuth CSRF state + PKCE

**Problém**: Bez `state` parametru je OAuth flow zranitelný vůči CSRF. Bez PKCE je authorization code exchange zranitelný vůči code interception.

**Fix implementovaný v PLAN.md (sekce 1.3)**:
```typescript
// 1. Generace state + PKCE při /auth/google:
const state = crypto.randomBytes(32).toString('hex');
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

// Uložit do cookies (SameSite=Lax – nutné pro OAuth redirect z Googlu)
reply.setCookie('oauth_state', state, { httpOnly: true, sameSite: 'Lax', maxAge: 600 });
reply.setCookie('pkce_verifier', codeVerifier, { httpOnly: true, sameSite: 'Lax', maxAge: 600 });

// 2. Validace v /auth/google/callback:
if (!request.cookies.oauth_state || request.cookies.oauth_state !== request.query.state) {
  return reply.code(400).send({ error: 'Invalid state' });
}
```

**Kritická poznámka**: `oauth_state` cookie musí mít `SameSite=Lax` (ne Strict), protože redirect z Googlu zpět na callback je cross-site redirect a `SameSite=Strict` cookie by nebyla odeslána.

### K2: AES-256-GCM správná implementace

**Problém**: Původní plán nespecifikoval generaci IV/nonce. Opakování nonce u GCM = katastrofické (útočník může dešifrovat všechna data).

**Fix implementovaný v PLAN.md (sekce 1.2)**:
```typescript
// Správná implementace:
const KEY = Buffer.from(process.env.NOTION_ENCRYPTION_KEY!, 'hex');
if (KEY.length !== 32) throw new Error('NOTION_ENCRYPTION_KEY must be 64 hex chars');

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit, vždy náhodný
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bajtů
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
  // Format: [iv(12)] [tag(16)] [ciphertext(n)]
}
```

### K3: iOS cookie persistence

**Problém**: Ruční ukládání HTTPOnly cookie hodnoty do Keychain obchází bezpečnostní model HTTPOnly. Pokud útočník získá přístup k Keychain (jailbreak), má JWT.

**Fix implementovaný v PLAN.md (sekce 5.3)**:
- `HTTPCookieStorage.shared` persistuje cookies automaticky mezi restarty – není potřeba Keychain
- Nastavit `URLSessionConfiguration.default.httpCookieStorage = .shared`
- Backend session cookie přijde v Set-Cookie headeru a iOS ji uloží automaticky

### K4: iOS id_token validace

**Problém**: Bez validace id_tokenu mohl útočník poslat libovolné JWT na `/auth/mobile` a získat session.

**Fix implementovaný v PLAN.md (sekce 1.3)**:
```typescript
// Backend validace Google id_token:
const response = await fetch(
  `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  { signal: AbortSignal.timeout(5000) }
);
const payload = await response.json();
if (payload.aud !== process.env.GOOGLE_CLIENT_ID_IOS) throw new Error('Invalid audience');
if (payload.exp < Date.now() / 1000) throw new Error('Token expired');
```

### V3 + S5: trustProxy konfigurace

**Problém**: Bez `trustProxy: 1` v Fastify instanci bere `@fastify/rate-limit` `req.ip` jako IP Traefiku (10.x.x.x), ne klientovu IP. Všichni uživatelé by sdíleli jeden rate limit bucket.

**Fix implementovaný v PLAN.md (sekce 1.1)**:
```typescript
const fastify = Fastify({
  trustProxy: 1, // důvěřuj 1 hop (Traefik); bere první IP z X-Forwarded-For
  logger: pinoOptions
});
```

---

## Co funguje dobře (nezměněno)

- **Notion jako primary DB** – elegantní architektura bez sync problémů
- **SQLite pouze pro auth** – správné oddělení zodpovědností
- **HTTPOnly + Secure + SameSite=Strict** – session cookie správně konfigurovaná
- **Sessions v SQLite** – umožňují granulární logout bez rotace JWT secret
- **Pino redact** – sensitívní data nejsou logována
- **Multi-stage Docker + non-root user** – production-ready kontejnery
- **Rollback deploy** – health check + automatický rollback
- **SSRF ochrana** – Notion URL je hardcoded
- **Zod validace** na vstupu + výstupu
- **SQLite WAL mode** – správná konfigurace pro concurrent reads
- **gitleaks jako první CI krok** – zabrání commitu secrets
- **Dependabot** pro automatické dependency updates
- **Uptime Kuma + SSL monitoring** – proaktivní alerting

---

## Celkové hodnocení po opravách

| Oblast | Hodnocení |
|--------|-----------|
| Architektura | A- |
| Bezpečnost | A- (po opravách kritických mezer) |
| Technologická aktualnost | A (Vitest 2.x, Swift 6, Tailwind v3) |
| Implementovatelnost | B+ (Tailwind v3 eliminuje kompatibilní riziko) |
| Test coverage strategie | A |

**Verdict**: Plán je po aplikovaných opravách připraven k implementaci. Dvě kritické bezpečnostní mezery (OAuth state/PKCE a iOS id_token validace) byly uzavřeny. Technologický stack je aktuální a produkčně vhodný.
