import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { desktop } from './desktop';
import { serveOfflineReads } from './offline/desktopReads';
import { registerServiceWorker } from './offline/registerServiceWorker';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/player.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

void registerServiceWorker();
serveOfflineReads(desktop);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
