const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const env = {
  brandName: import.meta.env.VITE_BRAND_NAME?.trim() || 'Osmani TV',
  defaultChannelId: import.meta.env.VITE_DEFAULT_CHANNEL_ID?.trim() || '',
  sessionStorageKey:
    import.meta.env.VITE_SESSION_STORAGE_KEY?.trim() || 'osmani_tv_web_session',
  useCredentials:
    String(import.meta.env.VITE_API_INCLUDE_CREDENTIALS || 'false').trim() ===
    'true',
  osmaniTvApiUrl: trimTrailingSlash(
    import.meta.env.VITE_OSMANI_TV_API_URL?.trim() || '/osmani-tv-proxy',
  ),
  osmaniAdminApiUrl: trimTrailingSlash(
    import.meta.env.VITE_OSMANI_ADMIN_API_URL?.trim() || '/osmani-admin-proxy',
  ),
  streamProxyBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_STREAM_PROXY_BASE_URL?.trim() ||
      '/osmani-admin-proxy/stream-proxy',
  ),
  channelsPath: import.meta.env.VITE_CHANNELS_API_PATH?.trim() || '/api/channels',
  settingsPath: import.meta.env.VITE_SETTINGS_API_PATH?.trim() || '/api/settings',
  bannersPath: import.meta.env.VITE_BANNERS_API_PATH?.trim() || '/api/banners',
  popupSettingsPath:
    import.meta.env.VITE_POPUP_SETTINGS_API_PATH?.trim() ||
    '/api/popup-settings',
  whatsappSettingsPath:
    import.meta.env.VITE_WHATSAPP_SETTINGS_API_PATH?.trim() ||
    '/api/whatsapp-settings',
  legacyApiHealthPath:
    import.meta.env.VITE_OSMANI_TV_HEALTH_PATH?.trim() || '/api',
}

export const apiReadiness = {
  tv: Boolean(env.osmaniTvApiUrl),
  admin: Boolean(env.osmaniAdminApiUrl),
  stream: Boolean(env.streamProxyBaseUrl),
}
