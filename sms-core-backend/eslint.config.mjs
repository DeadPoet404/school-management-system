import eslint from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/**'],
  },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Phase 2: Promoted from 'warn' to 'error'.
      // Any new 'any' usage will now fail lint.
      // Existing violations (27+) should be systematically replaced
      // with proper interfaces. Use // eslint-disable-next-line
      // sparingly and only with a justification comment.
      '@typescript-eslint/no-explicit-any': 'error',
      // Phase 2: Production code should use the structured Pino logger
      // (import { logger } from '@/lib/logger'), not console.log/error.
      // Currently 15+ violations exist — these will be fixed incrementally.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettierConfig,
];
