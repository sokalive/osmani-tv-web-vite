function localeCountryCodeUpper() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || ''
    const parts = String(locale).replace('_', '-').split('-')
    const region = parts.length >= 2 ? parts[parts.length - 1] : ''
    if (/^[A-Za-z]{2}$/.test(region)) {
      return region.toUpperCase()
    }
  } catch {
    return ''
  }

  return ''
}

function localeFallback() {
  return { countryCode: localeCountryCodeUpper(), city: '', region: '' }
}

function normalizeText(value: unknown) {
  return value != null ? String(value).trim() : ''
}

function normalizeCountryCode(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : ''
}

async function fetchJsonWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return (await response.json()) as Record<string, unknown>
  } finally {
    window.clearTimeout(timer)
  }
}

function parseIpWho(data: Record<string, unknown> | null) {
  if (!data || data.success === false) {
    return null
  }

  const countryCode = normalizeCountryCode(data.country_code)
  if (!countryCode) {
    return null
  }

  const city = normalizeText(data.city)
  let region = normalizeText(data.region)
  if (!region) {
    region = normalizeText(data.regionName)
  }

  return { countryCode, city, region }
}

function parseIpApiCo(data: Record<string, unknown> | null) {
  if (!data || data.error) {
    return null
  }

  const countryCode = normalizeCountryCode(data.country_code)
  if (!countryCode) {
    return null
  }

  const city = normalizeText(data.city)
  let region = normalizeText(data.region)
  if (!region) {
    region = normalizeText(data.region_code)
  }

  return { countryCode, city, region }
}

let cachedPayload: { countryCode: string; city: string; region: string } | null = null
let backgroundGeoPromise: Promise<void> | null = null

async function resolveIpGeoOnce() {
  const fallback = localeFallback()

  try {
    try {
      const payload = parseIpWho(await fetchJsonWithTimeout('https://ipwho.is/'))
      if (payload?.countryCode) {
        return payload
      }
    } catch {
      // Try the next provider.
    }

    try {
      const payload = parseIpApiCo(await fetchJsonWithTimeout('https://ipapi.co/json/'))
      if (payload?.countryCode) {
        return payload
      }
    } catch {
      // Fall through to locale fallback.
    }
  } catch {
    return fallback
  }

  return fallback
}

function ensureBackgroundGeoResolve() {
  if (cachedPayload != null || backgroundGeoPromise != null) {
    return
  }

  backgroundGeoPromise = resolveIpGeoOnce()
    .then((payload) => {
      cachedPayload = payload
    })
    .catch(() => {
      cachedPayload = localeFallback()
    })
    .finally(() => {
      backgroundGeoPromise = null
    })
}

export async function getAnalyticsLocationPayload() {
  try {
    if (cachedPayload != null) {
      return cachedPayload
    }

    ensureBackgroundGeoResolve()
    return localeFallback()
  } catch {
    return localeFallback()
  }
}
