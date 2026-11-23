import { defineConfig } from 'vitest/config';
import path from 'node:path';

// A shared screen's `X.web.tsx` takes the place of its `X.tsx` here (DECISIONS.md#d-193).
const WEB_FIRST = ['.web.tsx', '.web.ts', '.web.js', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

export default defineConfig({
  // Like vite.config.ts: the shared React Native screens render as DOM (issue #237).
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      // Mock the TV-only tv-media module that VideoPreview dynamically imports
      '../../../../apps/tv-app/modules/tv-media': path.resolve(__dirname, 'src/test/mocks/tv-media.ts'),
    },
    extensions: WEB_FIRST,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
});
