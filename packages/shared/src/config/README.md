# config

`appConfig.ts` turns raw env values (`APP_NAME`, `APP_SLUG`, `APP_API_BASE_URL`) into a typed `AppConfig`.
Each app passes its own env object (Vite `import.meta.env`, Expo `Constants.expoConfig.extra`).
