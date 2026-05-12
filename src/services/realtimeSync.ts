import { env } from '../config/env'

type RealtimeEventPayload = unknown
type RealtimeEventCallback = (payload: RealtimeEventPayload) => void
type RealtimeDebugCallback = (snapshot: RealtimeDebugSnapshot) => void

export type RealtimeDebugSnapshot = {
  connected: boolean
  url: string
  attemptIndex: number
  lastOpenAt: number
  lastEventAt: number
  lastError: string
}

const RECONNECT_MS = 15000
const KNOWN_EVENTS = [
  'message',
  'snapshot',
  'channels_changed',
  'channel_changed',
  'channel_updated',
  'banners_changed',
  'banner_changed',
  'banner_updated',
  'whatsapp_settings_changed',
  'popup_settings_changed',
  'server_health_changed',
  'subscription_revoked',
  'app_settings_changed',
  'app_version_changed',
  'app_version',
  'settings',
  'sync',
  'update',
  'transfer_requested',
  'transfer_confirmation_required',
  'transfer_pending',
  'transfer_approved',
  'transfer_rejected',
  'transfer_completed',
]

const listeners = new Map<string, Set<RealtimeEventCallback>>()
const debugListeners = new Set<RealtimeDebugCallback>()

let eventSource: EventSource | null = null
let reconnectTimer: number | null = null
let started = false
let lastOpenAt = 0
let lastEventAt = 0
let lastError = ''
let attemptIndex = 0

function resolveSyncUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URL(
    `${env.osmaniAdminApiUrl.replace(/\/+$/, '')}/api/sync/stream`,
    window.location.origin,
  ).toString()
}

function parsePayload(raw: string | null | undefined) {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(String(raw))
  } catch {
    return raw
  }
}

function emit(name: string, payload: RealtimeEventPayload) {
  const scoped = listeners.get(name)
  if (scoped) {
    scoped.forEach((callback) => {
      try {
        callback(payload)
      } catch {
        return
      }
    })
  }

  const wildcard = listeners.get('*')
  if (wildcard) {
    wildcard.forEach((callback) => {
      try {
        callback({ name, payload })
      } catch {
        return
      }
    })
  }
}

function getDebugSnapshot(): RealtimeDebugSnapshot {
  return {
    connected: Boolean(eventSource),
    url: resolveSyncUrl(),
    attemptIndex,
    lastOpenAt,
    lastEventAt,
    lastError,
  }
}

function emitDebug() {
  const snapshot = getDebugSnapshot()
  debugListeners.forEach((callback) => {
    try {
      callback(snapshot)
    } catch {
      return
    }
  })
}

function clearReconnect() {
  if (reconnectTimer != null && typeof window !== 'undefined') {
    window.clearTimeout(reconnectTimer)
  }
  reconnectTimer = null
}

function disconnect() {
  clearReconnect()
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  emitDebug()
}

function handleFrame(name: string, payload: RealtimeEventPayload) {
  lastEventAt = Date.now()
  lastError = ''
  emitDebug()
  emit(name, payload)

  if (
    payload &&
    typeof payload === 'object' &&
    'event' in payload &&
    typeof (payload as { event?: unknown }).event === 'string'
  ) {
    const declaredEvent = String((payload as { event: string }).event)
    emit(declaredEvent, payload)
  }
}

function attachEventListener(name: string) {
  if (!eventSource) {
    return
  }

  eventSource.addEventListener(name, (event) => {
    const payload = parsePayload((event as MessageEvent).data)
    handleFrame(name, payload)
  })
}

function connect() {
  if (
    !started ||
    eventSource ||
    typeof window === 'undefined' ||
    typeof window.EventSource === 'undefined'
  ) {
    return
  }

  const url = resolveSyncUrl()
  if (!url) {
    return
  }

  attemptIndex += 1
  try {
    eventSource = new window.EventSource(url, {
      withCredentials: env.useCredentials,
    })
  } catch {
    lastError = 'connect_failed'
    emitDebug()
    reconnectTimer = window.setTimeout(connect, RECONNECT_MS)
    return
  }

  eventSource.addEventListener('open', () => {
    lastOpenAt = Date.now()
    lastError = ''
    emitDebug()
  })
  KNOWN_EVENTS.forEach(attachEventListener)

  eventSource.onerror = () => {
    lastError = 'connection_error'
    disconnect()
    if (started && typeof window !== 'undefined') {
      reconnectTimer = window.setTimeout(connect, RECONNECT_MS)
    }
  }
}

export function startRealtimeSync() {
  if (started) {
    return
  }

  started = true
  connect()
}

export function stopRealtimeSync() {
  started = false
  disconnect()
}

export function subscribeRealtimeEvent(
  name: string,
  callback: RealtimeEventCallback,
) {
  if (!listeners.has(name)) {
    listeners.set(name, new Set())
  }

  listeners.get(name)?.add(callback)

  return () => {
    const set = listeners.get(name)
    if (!set) {
      return
    }

    set.delete(callback)
    if (set.size === 0) {
      listeners.delete(name)
    }
  }
}

export function getRealtimeDebugSnapshot() {
  return getDebugSnapshot()
}

export function subscribeRealtimeDebug(callback: RealtimeDebugCallback) {
  debugListeners.add(callback)

  try {
    callback(getDebugSnapshot())
  } catch {
    return () => {
      debugListeners.delete(callback)
    }
  }

  return () => {
    debugListeners.delete(callback)
  }
}
