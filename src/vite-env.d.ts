/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND_NAME?: string
  readonly VITE_DEFAULT_STREAM_URL?: string
  readonly VITE_OSMANI_TV_API_URL?: string
  readonly VITE_OSMANI_ADMIN_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
