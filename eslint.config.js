import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'node_modules/',
      '_backup-v4/',
      '_backup-v6/',
      'dist/',
      'docs/',
      'playwright-report/',
      'test-results/',
      '.e2e/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Node code: this config
    files: ['eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]);
