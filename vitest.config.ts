import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      thresholds: {
        'src/validator/**': { lines: 85, branches: 85, functions: 90, statements: 85 },
        'src/scorer/**': { lines: 85, branches: 85, functions: 90, statements: 85 },
        'src/solver/**': { lines: 85, branches: 80, functions: 90, statements: 85 },
        'src/**': { lines: 75, branches: 70, functions: 80, statements: 75 },
      },
    },
  },
});
