import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Like vite.config.ts: the shared React Native screens render as DOM (issue #237).
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
});
