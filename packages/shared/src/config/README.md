# config

`appConfig.ts` turns raw env values (`APP_NAME`, `APP_SLUG`) into a typed `AppConfig`.
Each app passes its own env object (Vite `import.meta.env`, Expo `Constants.expoConfig.extra`).
