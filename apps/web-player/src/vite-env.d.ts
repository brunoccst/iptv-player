/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_NAME?: string;
  readonly APP_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
