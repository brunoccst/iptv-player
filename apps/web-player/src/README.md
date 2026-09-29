# src

| Path              | Purpose                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.tsx`        | Registers the Service Worker, mounts React.                                                                                                                          |
| `App.tsx`         | Gate: restoring → login → profile picker → shell. Opens My Downloads when offline.                                                                                   |
| `appContext.ts`   | Shared app context (API + stores), downloads store, UI store. Session in `localStorage` (`<APP_SLUG>:session`).                                                      |
| `config.ts`       | `appConfig` from `import.meta.env`.                                                                                                                                  |
| `buildInfo.ts`    | Commit and time of the build (`__BUILD_INFO__` from `vite.config.ts`), for About.                                                                                    |
| `desktopTexts.ts` | The desktop app's update dialogs in the app's language, sent to the main process (D-084).                                                                            |
| `desktop.ts`      | What the desktop app (`apps/desktop`, D-071) adds to the page; absent in a browser. With it, the app talks to the provider directly and stores data through the app. |
| `components/`     | Reusable UI pieces.                                                                                                                                                  |
| `features/`       | Screens and feature components.                                                                                                                                      |
| `hooks/`          | Store hooks and `useAsync`.                                                                                                                                          |
| `offline/`        | Download manager, encryption, Service Worker.                                                                                                                        |
| `styles/`         | Global CSS (tokens, components, pages, player).                                                                                                                      |
| `ui/`             | Navigation store, play/download target builders, error text.                                                                                                         |
