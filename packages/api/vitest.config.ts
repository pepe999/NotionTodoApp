import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // Cílové prahy revidujeme ve Fázi 2 (dedikované testy backendu).
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
