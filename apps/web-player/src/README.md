# src

| File | Purpose |
|------|---------|
| `main.tsx` | Mounts React into `#root`. |
| `App.tsx` | Root component. |
| `config.ts` | Builds `appConfig` from `import.meta.env` via `@iptv/shared`. |
| `appContext.ts` | Creates the shared app context (API client + stores). Session persisted in `localStorage` under `<APP_SLUG>:session`. |
| `styles.css` | Global styles and colour tokens (background `#141414`). |
