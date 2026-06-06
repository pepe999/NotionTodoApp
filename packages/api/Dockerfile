# Produkční multi-stage build backendu (PLAN.md 7.2).
# Server je ARM – build běží lokálně na serveru (viz deploy.yml), proto se
# nativní better-sqlite3 zkompiluje pro správnou architekturu.

FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Manifesty zvlášť kvůli cache vrstvy závislostí.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci

COPY . .
# Build (tsup bundluje @notiontodoapp/shared dovnitř) + odstranění devDeps.
RUN npm run build --workspace @notiontodoapp/api \
    && npm prune --omit=dev

FROM node:20-alpine AS runtime
RUN apk add --no-cache curl
ENV NODE_ENV=production
WORKDIR /app

# Adresář pro SQLite (named volume) vlastněný non-root uživatelem.
RUN mkdir -p /data && chown node:node /data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["node", "packages/api/dist/index.js"]
