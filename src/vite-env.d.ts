/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND_NAME?: string
  readonly VITE_DEFAULT_CHANNEL_ID?: string
  readonly VITE_SESSION_STORAGE_KEY?: string
  readonly VITE_API_INCLUDE_CREDENTIALS?: string
  readonly VITE_OSMANI_TV_API_URL?: string
  readonly VITE_OSMANI_ADMIN_API_URL?: string
  readonly VITE_STREAM_PROXY_BASE_URL?: string
  readonly VITE_CHANNELS_API_PATH?: string
  readonly VITE_SETTINGS_API_PATH?: string
  readonly VITE_BANNERS_API_PATH?: string
  readonly VITE_POPUP_SETTINGS_API_PATH?: string
  readonly VITE_WHATSAPP_SETTINGS_API_PATH?: string
  readonly VITE_OSMANI_TV_HEALTH_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
