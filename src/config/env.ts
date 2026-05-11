const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const env = {
  brandName: import.meta.env.VITE_BRAND_NAME?.trim() || 'Osmani TV',
  defaultStreamUrl: import.meta.env.VITE_DEFAULT_STREAM_URL?.trim() || '',
  osmaniTvApiUrl: trimTrailingSlash(
    import.meta.env.VITE_OSMANI_TV_API_URL?.trim() || '',
  ),
  osmaniAdminApiUrl: trimTrailingSlash(
    import.meta.env.VITE_OSMANI_ADMIN_API_URL?.trim() || '',
  ),
}

export const apiReadiness = {
  tv: Boolean(env.osmaniTvApiUrl),
  admin: Boolean(env.osmaniAdminApiUrl),
  stream: Boolean(env.defaultStreamUrl),
}
