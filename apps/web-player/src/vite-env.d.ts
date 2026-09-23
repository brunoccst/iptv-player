/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_NAME?: string;
  readonly APP_SLUG?: string;
  readonly APP_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
