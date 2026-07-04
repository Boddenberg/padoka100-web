/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_LOCAL_URL?: string;
  readonly VITE_API_PROD_URL?: string;
  readonly VITE_DEFAULT_API_ENV?: "local" | "production";
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
