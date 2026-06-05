import { defineConfig } from 'tsup';

// Multi-stage produkční build (Fáze 7.2) spustí `npm run build`.
// Závislosti (včetně nativního better-sqlite3) zůstávají externí – instalují
// se v runtime image přes `npm ci --omit=dev`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // SQL migrace nejsou součástí JS bundlu – runtime je čte z dist/migrations
  // (cesta dirname(import.meta.url)/migrations). Build běží na Linuxu (CI/Docker).
  onSuccess: 'cp -r src/db/migrations dist/migrations',
});
