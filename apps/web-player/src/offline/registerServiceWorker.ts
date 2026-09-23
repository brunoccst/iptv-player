/** Registers `/sw.js` (built or served by the Vite plugin in vite.config.ts). Resolves null when unsupported. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed; offline playback disabled.', error);
    return null;
  }
}
