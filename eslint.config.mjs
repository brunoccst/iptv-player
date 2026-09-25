// Lint rules for all TypeScript/JavaScript workspaces. Formatting is Prettier's job (eslint-config-prettier). See DECISIONS.md#d-033.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-e2e/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/test-results/**',
      '**/coverage/**',
      'apps/tv-app/android/**',
      'apps/tv-app/ios/**',
      'packages/shared/src/api/generated/**',
      'backend/**',
      'services/**',
      'tools/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'apps/tv-app/test/**', 'apps/tv-app/jest.config.js', 'apps/tv-app/babel.config.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Expo config plugins are loaded by Node as CommonJS during prebuild.
    files: ['apps/tv-app/plugins/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
