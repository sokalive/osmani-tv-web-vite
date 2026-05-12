import { env } from '../config/env'
import { getDeviceIdentity } from './auth/deviceIdentity'

export const PING_MS = 30000

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

async function postJson(path: string, body: Record<string, unknown>) {
  const baseUrl = resolveBaseUrl(env.osmaniAdminApiUrl).replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    keepalive: true,
  })

  return response.ok
}

export async function startLiveSession(channelId: string, channelName: string) {
  const { deviceId } = await getDeviceIdentity()
  await postJson('/api/analytics/session/start', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    channel_name: String(channelName || ''),
    country: detectCountry(),
    started_at: new Date().toISOString(),
  }).catch(() => false)
  return deviceId
}

export async function pingLiveSession(deviceId: string, channelId: string) {
  if (!deviceId) {
    return
  }

  await postJson('/api/analytics/session/heartbeat', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    country: detectCountry(),
    timestamp: new Date().toISOString(),
  }).catch(() => false)
}

export async function stopLiveSession(deviceId: string, channelId: string) {
  if (!deviceId) {
    return
  }

  await postJson('/api/analytics/session/end', {
    device_id: deviceId,
    channel_id: String(channelId || ''),
    country: detectCountry(),
    ended_at: new Date().toISOString(),
  }).catch(() => false)
}
