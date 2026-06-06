# Produkční build frontendu (PLAN.md 7.2): Vite build → statické soubory v nginx.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci
COPY . .
RUN npm run build --workspace @notiontodoapp/web

FROM nginx:alpine AS runtime
# Šablona: nginx oficiální image dosadí ${API_ORIGIN} z env do conf.d.
COPY packages/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
