# Nasazení (Fáze 7)

Produkční nasazení modelem **A** (lokální build na serveru), shodně se zbytkem
serveru: root, `/opt/apps/notion-todo-app`, sdílený Traefik, ARM (aarch64).

## Architektura

```
Internet → Traefik (HTTPS, Let's Encrypt) ─┬─ web  (nginx, statická SPA)   Host(${DOMAIN})
                                            └─ api  (Node, Fastify)         Host(${API_DOMAIN})
                                                     └─ SQLite (named volume sqlite-data)
```

Produkční soubory: `docker-compose.prod.yml`, `packages/api/Dockerfile`,
`packages/web/Dockerfile` + `packages/web/nginx.conf`.

## 7.1 Příprava serveru (jednorázově)
1. `git clone` repo do `/opt/apps/notion-todo-app`.
2. Vytvoř `.env` (viz `.env.example`) – povinné navíc pro produkci:
   `DOMAIN`, `API_DOMAIN`, `JWT_SECRET`, `NOTION_ENCRYPTION_KEY`, Google OAuth,
   volitelně `METRICS_TOKEN`, `APNS_*`, `BACKUP_ENCRYPTION_KEY`.
3. DNS: `A` záznam pro `${DOMAIN}` i `${API_DOMAIN}` → IP serveru.
4. Běžící Traefik se sítí `traefik-public` a resolverem `letsencrypt`
   (viz `infra/traefik/`).

## 7.2 Build & běh
```bash
cd /opt/apps/notion-todo-app
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T api curl -fsS http://localhost:3000/health
```
Hardening: api běží jako non-root, `read_only` rootfs + tmpfs, `cap_drop: ALL`,
`no-new-privileges`. Migrace SQLite se aplikují automaticky při startu.

> **Pozn. k produkčnímu buildu (ověřeno ve Fázi 7):** tsup bundluje
> `@notiontodoapp/shared` dovnitř (jinak by `node` neuměl načíst TS zdroj),
> migrační CLI je oddělené (`migrate-cli.ts`) a kopírování migrací do `dist` je
> idempotentní. Bez těchto oprav by produkční `node dist/index.js` spadl.

## 7.3 CD (GitHub Actions)
`.github/workflows/deploy.yml` – SSH na server, `git reset --hard origin/main`,
`docker compose -f docker-compose.prod.yml up -d --build`, health check, při
selhání **rollback** na předchozí commit. Trigger je zatím `workflow_dispatch`;
po prvním úspěšném ručním nasazení odkomentuj `push: branches: [main]`.

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

## 7.4 Monitoring + alerting
- **Uptime**: externí monitor (Uptime Kuma) na `https://${API_DOMAIN}/health`
  a `https://${DOMAIN}` + kontrola expirace TLS certifikátu.
- **Metriky**: `GET https://${API_DOMAIN}/metrics` s `Authorization: Bearer
  ${METRICS_TOKEN}` (Prometheus formát). Bez tokenu vrací 404.
- **Logy**: Pino JSON (redakce tokenů/e-mailů) → `docker compose logs` / log driver.

## 7.5 Zálohy
`scripts/backup.sh` – GPG (AES-256) šifrovaný snapshot SQLite s rotací.
Doporučený cron (denně) na serveru:
```cron
0 3 * * * BACKUP_ENCRYPTION_KEY=... DB_PATH=$(docker volume inspect notion-todo-app_sqlite-data -f '{{.Mountpoint}}')/app.sqlite /opt/apps/notion-todo-app/scripts/backup.sh
```
Obnova: `gpg -d nta-backup-*.tar.gz.gpg | tar -xzO > app.sqlite`, pak zkopírovat
do volume a restartovat api.

## Rollback (ruční)
```bash
cd /opt/apps/notion-todo-app
git reset --hard <předchozí-commit>
docker compose -f docker-compose.prod.yml up -d --build
```
