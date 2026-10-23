import { defineConfig } from 'vitest/config';

// A shared screen's `X.web.tsx` takes the place of its `X.tsx` here (DECISIONS.md#d-193).
const WEB_FIRST = ['.web.tsx', '.web.ts', '.web.js', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

export default defineConfig({
  // Like vite.config.ts: the shared React Native screens render as DOM (issue #237).
  resolve: { alias: { 'react-native': 'react-native-web' }, extensions: WEB_FIRST },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
});
