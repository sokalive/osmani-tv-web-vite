import {
  PRESENCE_PING_MS,
  pingAppPresence,
  startAppPresence,
  stopAppPresence,
} from './analytics'

const BACKGROUND_GRACE_MS = 4000

let sessionId = ''
let deviceId = ''
let activeChannelId: string | null = null
let activeChannelName: string | null = null
let heartbeatTimer: number | null = null
let pendingStopTimer: number | null = null
let lifecycleBound = false
let started = false
let starting = false

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(() => {
    void pingAppPresence({
      sessionId,
      deviceId,
      channelId: activeChannelId,
      channelName: activeChannelName,
    })
  }, PRESENCE_PING_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer != null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function cancelPendingStop() {
  if (pendingStopTimer != null) {
    window.clearTimeout(pendingStopTimer)
    pendingStopTimer = null
  }
}

function stopPresenceNow() {
  cancelPendingStop()
  stopHeartbeat()
  if (!started || !sessionId) {
    return
  }

  const currentSessionId = sessionId
  const currentDeviceId = deviceId
  started = false
  void stopAppPresence({ sessionId: currentSessionId, deviceId: currentDeviceId })
}

function scheduleBackgroundStop() {
  if (!started || pendingStopTimer != null) {
    return
  }

  pendingStopTimer = window.setTimeout(() => {
    pendingStopTimer = null
    stopPresenceNow()
  }, BACKGROUND_GRACE_MS)
}

async function handleForeground() {
  cancelPendingStop()

  if (!started && !starting) {
    await startPresence()
    return
  }

  if (!started || !sessionId) {
    return
  }

  startHeartbeat()
  void pingAppPresence({
    sessionId,
    deviceId,
    channelId: activeChannelId,
    channelName: activeChannelName,
  })
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void handleForeground()
    return
  }

  if (document.visibilityState === 'hidden') {
    scheduleBackgroundStop()
  }
}

function onPageShow() {
  void handleForeground()
}

function onPageHide() {
  stopPresenceNow()
}

function ensureLifecycleBindings() {
  if (lifecycleBound || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  lifecycleBound = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onPageShow)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onPageHide)
}

function removeLifecycleBindings() {
  if (!lifecycleBound || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  lifecycleBound = false
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('focus', onPageShow)
  window.removeEventListener('pageshow', onPageShow)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('beforeunload', onPageHide)
}

export async function startPresence() {
  if (started || starting) {
    return
  }

  starting = true
  try {
    const result = await startAppPresence()
    sessionId = result.sessionId || sessionId
    deviceId = result.deviceId || deviceId
    ensureLifecycleBindings()

    if (!sessionId) {
      return
    }

    started = true
    startHeartbeat()

    if (activeChannelId || activeChannelName) {
      void pingAppPresence({
        sessionId,
        deviceId,
        channelId: activeChannelId,
        channelName: activeChannelName,
      })
    }
  } finally {
    starting = false
  }
}

export async function stopPresence(options: { keepLifecycleBindings?: boolean } = {}) {
  stopPresenceNow()

  if (!options.keepLifecycleBindings) {
    removeLifecycleBindings()
  }
}

export function setActiveChannel(channelId: string | null | undefined, channelName: string | null | undefined) {
  activeChannelId =
    channelId != null && String(channelId).trim() ? String(channelId).trim() : null
  activeChannelName =
    channelName != null && String(channelName).trim() ? String(channelName).trim() : null

  if (started && sessionId) {
    void pingAppPresence({
      sessionId,
      deviceId,
      channelId: activeChannelId,
      channelName: activeChannelName,
    })
  }
}

export function clearActiveChannel() {
  if (activeChannelId == null && activeChannelName == null) {
    return
  }

  activeChannelId = null
  activeChannelName = null

  if (started && sessionId) {
    void pingAppPresence({
      sessionId,
      deviceId,
      channelId: null,
      channelName: null,
    })
  }
}
