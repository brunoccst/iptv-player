import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';

// Root .env is the single config source. See DECISIONS.md#d-003.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const serviceWorkerEntry = fileURLToPath(new URL('./src/offline/serviceWorker.ts', import.meta.url));

/** Bundles the Service Worker as one classic script: served at /sw.js in dev, emitted as dist/sw.js in builds. See DECISIONS.md#d-024. */
function serviceWorker(): Plugin {
  const bundle = async (precache: string[], buildId: string, minify: boolean) => {
    const result = await esbuild({
      entryPoints: [serviceWorkerEntry],
      bundle: true,
      format: 'iife',
      target: 'es2022',
      write: false,
      minify,
      define: { __PRECACHE_MANIFEST__: JSON.stringify(precache), __BUILD_ID__: JSON.stringify(buildId) },
    });
    return result.outputFiles[0]!.text;
  };

  return {
    name: 'service-worker',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_request, response, next) => {
        bundle([], 'dev', false)
          .then((code) => {
            response.setHeader('Content-Type', 'text/javascript');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(code);
          })
          .catch(next);
      });
    },
    async generateBundle(_options, output) {
      const files = Object.keys(output).filter((file) => !file.endsWith('.map'));
      const buildId = String(files.join('|').length) + '-' + Date.now().toString(36);
      const precache = ['/', ...files.filter((file) => file !== 'index.html').map((file) => `/${file}`)];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: await bundle(precache, buildId, true) });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  envDir: repoRoot,
  envPrefix: ['VITE_', 'APP_'],
  server: {
    port: 5173,
    // GitHub Codespaces: only the web port is opened; /api goes through Vite to the backend. See DECISIONS.md#d-035.
    ...(process.env.CODESPACES === 'true'
      ? { allowedHosts: ['.app.github.dev'], hmr: { clientPort: 443 }, proxy: { '/api': 'http://localhost:5080' } }
      : {}),
  },
  preview: { port: 4173 },
  // hls.js alone is ~500 kB; it lives in the lazily loaded player chunk.
  build: { chunkSizeWarningLimit: 700 },
});
