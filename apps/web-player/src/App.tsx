import { appConfig } from './config';

export function App() {
  return (
    <main className="app-shell">
      <h1 className="app-title">{appConfig.appName}</h1>
      <p className="app-subtitle">Web player scaffold. API: {appConfig.apiBaseUrl}</p>
    </main>
  );
}
