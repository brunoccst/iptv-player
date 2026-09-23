# .devcontainer

GitHub Codespaces setup: the web app with the fake panel, usable from a phone browser. Rationale: [D-035](../documentation/DECISIONS.md#d-035).

| File | Purpose |
|------|---------|
| `devcontainer.json` | Ubuntu + Node 22, .NET 10, Python 3.11. Forwards only port 5173 (the web app). |
| `setup.sh` | Runs once when the codespace is created: `npm ci`, worker venv, H.264 test media (plays on phones), backend build. |
| `start.sh` | Runs on every start: `npm run dev:all -- --fake` in the background with the public HTTPS address as `APP_API_BASE_URL` / `BACKEND_PUBLIC_BASE_URL`. Log: `/tmp/iptv-dev.log`. |

```mermaid
flowchart LR
  PHONE[Phone browser] -->|https://NAME-5173.app.github.dev| VITE[Vite :5173]
  VITE -->|/api proxy| API[Backend :5080]
  API --> PANEL[Fake panel :8090]
  API --> DB[(SQLite)]
  WORKER[Title normalizer] --> DB
```

Sign in with server `http://localhost:8090`, username `demo`, password `demo` (the backend reaches the panel inside the codespace).
