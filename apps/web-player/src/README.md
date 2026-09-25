# src

| Path            | Purpose                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `main.tsx`      | Registers the Service Worker, mounts React.                                                                     |
| `App.tsx`       | Gate: restoring → login → profile picker → shell. Opens My Downloads when offline.                              |
| `appContext.ts` | Shared app context (API + stores), downloads store, UI store. Session in `localStorage` (`<APP_SLUG>:session`). |
| `config.ts`     | `appConfig` from `import.meta.env`.                                                                             |
| `components/`   | Reusable UI pieces.                                                                                             |
| `features/`     | Screens and feature components.                                                                                 |
| `hooks/`        | Store hooks and `useAsync`.                                                                                     |
| `offline/`      | Download manager, encryption, Service Worker.                                                                   |
| `styles/`       | Global CSS (tokens, components, pages, player).                                                                 |
| `ui/`           | Navigation store, play/download target builders, error text.                                                    |
