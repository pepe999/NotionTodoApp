import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // index.ts (bootstrap) a apns/sender.ts (HTTP/2 adaptér na reálné APNs)
      // jsou IO hranice mimo unit testy.
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/apns/sender.ts'],
      // Cílové prahy revidujeme ve Fázi 2 (dedikované testy backendu).
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
