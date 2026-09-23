# @iptv/web-player

Desktop browser client. React 19 + Vite + TypeScript. Deploy target: Azure Static Web Apps.

## Config

Reads `APP_*` keys from the repo root `.env` (Vite `envDir`). Override locally in root `.env.local`.

## Commands

```bash
npm run dev --workspace=@iptv/web-player        # http://localhost:5173
npm run build --workspace=@iptv/web-player      # output: dist/
npm run typecheck --workspace=@iptv/web-player
```

## Structure

| Path | Purpose |
|------|---------|
| `index.html` | HTML entry. `%APP_NAME%` is replaced at build time. |
| `vite.config.ts` | Vite config. Points env loading to repo root. |
| `src/` | Application source. |
