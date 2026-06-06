# Penetration testing checklist (Fáze 6.4)

Manuální checklist proti běžícímu staging prostředí. `[x]` = ověřeno v code review;
`[ ]` = nutno doověřit proti živému nasazení (vyžaduje VPS/staging z Fáze 7).

## Injection
- [x] **SQL injection** přes API parametry → `better-sqlite3` prepared statements
  (žádná konkatenace; ověřeno `git grep`).
- [x] **Path/SSRF injection** přes `databaseId`/`taskId` → UUID validace
  (`services/notion/ids.ts`) před interpolací do Notion cesty.
- [ ] **XSS** přes název/popis úkolu → React escapuje JSX; ověřit, že nikde není
  `dangerouslySetInnerHTML` (není) a že Notion hodnoty se renderují jako text.

## Autentizace & session
- [x] **JWT manipulation** (`alg: none`) → blokováno alg whitelistem `['HS256']`.
- [x] **Brute force** na `/auth/*` → rate limit 120/min/IP (úroveň 1).
- [x] **Logout invalidace** → session smazána z DB, cookie zrušena.
- [ ] **Cookie flagy** v reálné odpovědi → ověřit `HttpOnly; Secure; SameSite=Lax`
  přes `curl -i` proti produkci.
- [ ] **OAuth open redirect / CSRF** → `state` se ověřuje konstantně-časově;
  ověřit, že callback s cizím `state` vrátí 400.

## Access control
- [x] **IDOR** → data jdou jen přes Notion config přihlášeného uživatele
  (`req.user.id`); cizí task ID míří do vlastní DB útočníka.
- [ ] Ověřit, že volání `/api/*` bez cookie vrací 401 (smoke proti staging).

## Konfigurace & expozice
- [ ] **TLS** → Mozilla Observatory / testssl.sh (A/A+), platný Let's Encrypt cert.
- [ ] **Security headers** → securityheaders.com (CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy).
- [ ] **`/docs` (Swagger)** není dostupné v produkci (404).
- [ ] **`/metrics`** vrací 401/404 bez `METRICS_TOKEN`.
- [ ] **Traefik dashboard** není veřejně přístupný (jen localhost).
- [ ] **Stack trace** se v produkci neobjeví v 5xx odpovědích.

## DoS
- [x] `bodyLimit` 256 KB, `connectionTimeout`, `maxParamLength` 256.
- [ ] Ověřit 429 + `Retry-After` po překročení limitů proti staging.

## Nástroje
`curl -i`, OWASP ZAP / Burp Suite Community, testssl.sh, securityheaders.com,
Mozilla Observatory.
