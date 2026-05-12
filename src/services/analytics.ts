import { env } from '../config/env'
import { getAnalyticsLocationPayload } from './analyticsLocation'
import { getDeviceIdentity, getDeviceLabel } from './auth/deviceIdentity'

export const PING_MS = 30000
export const PRESENCE_PING_MS = 25000

const INSTALL_TRACKED_KEY = 'osmani:install_tracked_v1'
const RETRY_DELAYS_MS = [0, 700, 1800]

let cachedAppSessionId = ''

function resolveBaseUrl(rawBaseUrl: string) {
  if (/^https?:\/\//i.test(rawBaseUrl)) {
    return rawBaseUrl
  }

  if (typeof window !== 'undefined') {
    return new URL(rawBaseUrl, window.location.origin).toString()
  }

  return `http://localhost${rawBaseUrl.startsWith('/') ? rawBaseUrl : `/${rawBaseUrl}`}`
}

function detectCountry() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || ''
    const parts = String(locale).replace('_', '-').split('-')
    const region = parts.length >= 2 ? parts[parts.length - 1] : ''
    if (/^[A-Za-z]{2}$/.test(region)) {
      return region.toUpperCase()
    }
  } catch {
    return null
  }

  return null
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function detectDeviceModel() {
  return getDeviceLabel()
}

function detectAppVersion() {
  return import.meta.env.VITE_APP_VERSION?.trim() || 'web'
}

function detectPlatform() {
  return 'web'
}

async function getOrCreateAppSessionId() {
  if (cachedAppSessionId) {
    return cachedAppSessionId
  }

  cachedAppSessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`

  return cachedAppSessionId
}

async function wait(ms: number) {
  if (!ms) {
    return
  }

  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function resolveLocationEnvelope() {
  try {
    const location = await getAnalyticsLocationPayload()
    const countryCode =
      typeof location.countryCode === 'string' && location.countryCode.trim()
        ? location.countryCode.trim()
        : detectCountry() || ''

    return {
      countryCode,
      city: typeof location.city === 'string' ? location.city : '',
      region: typeof location.region === 'string' ? location.region : '',
      country: countryCode || null,
    }
  } catch {
    const countryCode = detectCountry() || ''
    return {
      countryCode,
      city: '',
      region: '',
      country: countryCode || null,
    }
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  options: {
    retries?: number[]
  } = {},
) {
  const retries = options.retries ?? RETRY_DELAYS_MS
  const baseUrl = resolveBaseUrl(env.osmaniAdminApiUrl).replace(/\/+$/, '')
  let lastError: unknown = null

  for (const delay of retries) {
    await wait(delay)
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        keepalive: true,
      })

      if (response.ok) {
        return true
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }

  if (import.meta.env.DEV) {
    console.warn('[analytics] request failed', path, lastError)
  }

  return false
}

export async function trackInstallOnce() {
  const storage = getStorage()

  try {
    if (storage?.getItem(INSTALL_TRACKED_KEY) === '1') {
      return
    }

    const { deviceId } = await getDeviceIdentity()
    const ok = await postJson('/api/analytics/install', {
      device_id: deviceId,
      platform: detectPlatform(),
      app_version: detectAppVersion(),
      country: detectCountry(),
      device_model: detectDeviceModel(),
    })

    if (ok) {
      storage?.setItem(INSTALL_TRACKED_KEY, '1')
    }
  } catch {
    return
  }
}

export async function startLiveSession(channelId: string, channelName: string) {
  const { deviceId } = await getDeviceIdentity()
  const location = await resolveLocationEnvelope()
  await postJson('/api/analytics/session/start', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    channel_name: String(channelName || ''),
    countryCode: location.countryCode,
    city: location.city,
    region: location.region,
    country: location.country,
    started_at: new Date().toISOString(),
  }).catch(() => false)
  return deviceId
}

export async function pingLiveSession(deviceId: string, channelId: string) {
  if (!deviceId) {
    return
  }

  const location = await resolveLocationEnvelope()
  await postJson('/api/analytics/session/heartbeat', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    countryCode: location.countryCode,
    city: location.city,
    region: location.region,
    country: location.country,
    timestamp: new Date().toISOString(),
  }).catch(() => false)
}

export async function stopLiveSession(deviceId: string, channelId: string) {
  if (!deviceId) {
    return
  }

  const location = await resolveLocationEnvelope()
  await postJson('/api/analytics/session/end', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    countryCode: location.countryCode,
    city: location.city,
    region: location.region,
    country: location.country,
    ended_at: new Date().toISOString(),
  }).catch(() => false)
}

export async function startAppPresence() {
  try {
    const sessionId = await getOrCreateAppSessionId()
    const { deviceId } = await getDeviceIdentity()
    const location = await resolveLocationEnvelope()
    const ok = await postJson('/api/analytics/presence/start', {
      session_id: sessionId,
      device_id: deviceId,
      platform: detectPlatform(),
      app_version: detectAppVersion(),
      device_model: detectDeviceModel(),
      countryCode: location.countryCode,
      city: location.city,
      region: location.region,
      country: location.country,
      started_at: new Date().toISOString(),
    })
    return { sessionId, deviceId, ok }
  } catch {
    return { sessionId: '', deviceId: '', ok: false }
  }
}

export async function pingAppPresence(args: {
  sessionId: string
  deviceId?: string
  channelId?: string | null
  channelName?: string | null
}) {
  if (!args.sessionId) {
    return false
  }

  const location = await resolveLocationEnvelope()
  return postJson(
    '/api/analytics/presence/heartbeat',
    {
      session_id: args.sessionId,
      device_id: args.deviceId ?? null,
      channel_id:
        args.channelId != null && args.channelId !== '' ? String(args.channelId) : null,
      channel_name:
        args.channelName != null && args.channelName !== ''
          ? String(args.channelName)
          : null,
      countryCode: location.countryCode,
      city: location.city,
      region: location.region,
      country: location.country,
      timestamp: new Date().toISOString(),
    },
    { retries: [0] },
  )
}

export async function stopAppPresence(args: { sessionId: string; deviceId?: string }) {
  if (!args.sessionId) {
    return false
  }

  const location = await resolveLocationEnvelope()
  return postJson(
    '/api/analytics/presence/stop',
    {
      session_id: args.sessionId,
      device_id: args.deviceId ?? null,
      countryCode: location.countryCode,
      city: location.city,
      region: location.region,
      country: location.country,
      ended_at: new Date().toISOString(),
    },
    { retries: [0, 600] },
  )
}
