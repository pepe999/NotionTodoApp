# Traefik (reverse proxy + HTTPS)

Spouští se **na VPS** odděleně od aplikace a poskytuje automatický Let's Encrypt
certifikát pro produkční domény (PLAN.md 0.6).

## Nasazení

```bash
# 1) Doplň e-mail v traefik.yml (certificatesResolvers.letsencrypt.acme.email)
# 2) Vytvoř úložiště certifikátů s korektními právy
touch acme.json && chmod 600 acme.json
# 3) Spusť
docker compose -f infra/traefik/docker-compose.yml up -d
```

## Napojení aplikace (produkce, Fáze 7)

Produkční `docker compose` služby `api` a `web` se připojí do sítě
`traefik-public` a dostanou Traefik labels, např.:

```yaml
services:
  api:
    networks: [traefik-public]
    labels:
      - traefik.enable=true
      - traefik.http.routers.api.rule=Host(`api.example.com`)
      - traefik.http.routers.api.entrypoints=websecure
      - traefik.http.routers.api.tls.certresolver=letsencrypt
      - traefik.http.services.api.loadbalancer.server.port=3000
  web:
    networks: [traefik-public]
    labels:
      - traefik.enable=true
      - traefik.http.routers.web.rule=Host(`example.com`)
      - traefik.http.routers.web.entrypoints=websecure
      - traefik.http.routers.web.tls.certresolver=letsencrypt
      - traefik.http.services.web.loadbalancer.server.port=80
```

> Lokální dev (`docker-compose.yml` v kořeni) Traefik nepoužívá – API i web
> jsou dostupné přímo na `:3000` a `:5173`.

## Dashboard

Dostupný jen přes SSH tunel (nikdy veřejně):

```bash
ssh -L 8080:127.0.0.1:8080 deploy@<VPS_IP>
# pak http://localhost:8080/dashboard/
```
