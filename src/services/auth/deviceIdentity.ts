const INSTALL_ID_KEY = 'osmani:install_uuid'

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

function getOrCreateInstallId() {
  const storage = getStorage()
  const existing = storage?.getItem(INSTALL_ID_KEY)?.trim()

  if (existing) {
    return existing
  }

  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `osmani-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  storage?.setItem(INSTALL_ID_KEY, created)
  return created
}

async function sha256(input: string) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(input),
    )

    return [...new Uint8Array(buffer)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  }

  return input
}

export function getDeviceLabel() {
  if (typeof navigator === 'undefined') {
    return 'Web Browser'
  }

  const ua = navigator.userAgent.toLowerCase()

  if (ua.includes('android')) {
    return 'Android Browser'
  }

  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
    return 'iPhone Browser'
  }

  if (ua.includes('windows')) {
    return 'Windows Browser'
  }

  if (ua.includes('mac os')) {
    return 'Mac Browser'
  }

  return 'Web Browser'
}

export async function getDeviceIdentity() {
  const installId = getOrCreateInstallId()
  const deviceId = installId
  const fingerprint = await sha256(
    [
      deviceId,
      getDeviceLabel(),
      typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      typeof location !== 'undefined' ? location.host : 'localhost',
    ].join('|'),
  )

  return {
    deviceId,
    deviceFingerprint: fingerprint,
  }
}
