import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Root .env is the single config source. See DECISIONS.md#d-003.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  plugins: [react()],
  envDir: repoRoot,
  envPrefix: ['VITE_', 'APP_'],
  server: { port: 5173 },
});
