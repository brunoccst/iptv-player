/// <reference lib="webworker" />
// Service Worker: serves downloads from encrypted storage and caches the app shell. Bundled by vite.config.ts.
import { createCacheChunkStore } from './chunkStore';
import { createOfflineDb } from './offlineDb';
import { respondOffline } from './offlineResponder';
import { OFFLINE_PREFIX } from './types';

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_MANIFEST__: string[];
declare const __BUILD_ID__: string;

const SHELL_CACHE = `app-shell-${__BUILD_ID__}`;
const deps = { db: createOfflineDb(self.indexedDB), chunks: createCacheChunkStore(self.caches, self.location.origin) };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (__PRECACHE_MANIFEST__.length > 0) await (await caches.open(SHELL_CACHE)).addAll(__PRECACHE_MANIFEST__);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('app-shell-') && name !== SHELL_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  if (url.pathname.startsWith(OFFLINE_PREFIX)) {
    event.respondWith(respondOffline(url, event.request.headers.get('range'), deps));
    return;
  }

  if (__PRECACHE_MANIFEST__.length === 0) return; // dev server: no shell caching

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match('/')) ?? Response.error()));
    return;
  }

  if (__PRECACHE_MANIFEST__.includes(url.pathname)) {
    event.respondWith((async () => (await caches.match(url.pathname)) ?? fetch(event.request))());
  }
});
