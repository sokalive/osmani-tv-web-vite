const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const parseInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(String(value ?? '').trim())
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export const env = {
  brandName: import.meta.env.VITE_BRAND_NAME?.trim() || 'Osmani TV',
  defaultChannelId: import.meta.env.VITE_DEFAULT_CHANNEL_ID?.trim() || '',
  appVersion: import.meta.env.VITE_APP_VERSION?.trim() || '1.0.0',
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
  osmaniAdminPaymentProxyUrl: trimTrailingSlash(
    import.meta.env.VITE_OSMANI_ADMIN_PAYMENT_PROXY_URL?.trim() ||
      '/osmani-admin-payment-proxy',
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
  updatePackageName:
    import.meta.env.VITE_UPDATE_PACKAGE_NAME?.trim() || 'com.osmantv.app',
  updateInstalledVersionName:
    import.meta.env.VITE_UPDATE_INSTALLED_VERSION_NAME?.trim() ||
    import.meta.env.VITE_APP_VERSION?.trim() ||
    '1.0.0',
  updateInstalledVersionCode: parseInteger(
    import.meta.env.VITE_UPDATE_INSTALLED_VERSION_CODE,
    1,
  ),
}

export const apiReadiness = {
  tv: Boolean(env.osmaniTvApiUrl),
  admin: Boolean(env.osmaniAdminApiUrl),
  adminPaymentProxy: Boolean(env.osmaniAdminPaymentProxyUrl),
  stream: Boolean(env.streamProxyBaseUrl),
}
