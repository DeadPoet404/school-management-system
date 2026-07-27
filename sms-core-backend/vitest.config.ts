import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    exclude: ['**/dist/**', '**/node_modules/**'],
    coverage: {
      thresholds: {
        statements: 30,
        branches: 18,
        functions: 22,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
