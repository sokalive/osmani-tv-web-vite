function isHlsPath(value: string) {
  const lower = value.toLowerCase()
  return lower.includes('.m3u8') || lower.includes('.m3u')
}

function decodeBase64UrlPart(part: string) {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)

  if (typeof globalThis.atob !== 'function') {
    return ''
  }

  return globalThis.atob(normalized + padding)
}

/**
 * Best-effort decode of stream-direct signed tokens to discover the upstream target URL.
 * Bein/YCN channels embed an http(s) .m3u8 target inside the token even though the
 * catalog URL itself is only `/stream-direct?token=…`.
 */
export function extractStreamDirectTokenTargets(url: string | null | undefined): string[] {
  if (!url || typeof url !== 'string') {
    return []
  }

  try {
    const parsed = new URL(url, 'http://localhost')
    const token = parsed.searchParams.get('token')
    if (!token) {
      return []
    }

    const hints = new Set<string>()
    for (const part of token.split('.')) {
      if (!part) {
        continue
      }

      try {
        const decoded = decodeBase64UrlPart(part)
        const matches = decoded.match(/https?:\/\/[^\s"'<>]+/gi)
        if (matches) {
          matches.forEach((match) => hints.add(match))
        }
      } catch {
        continue
      }
    }

    return [...hints]
  } catch {
    return []
  }
}

export function isStreamDirectHlsDelivery(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  if (!/\/stream-direct(?:$|[/?#])/i.test(url)) {
    return false
  }

  return extractStreamDirectTokenTargets(url).some((target) => isHlsPath(target))
}

/**
 * Detect whether a URL (including stream-proxy `?url=` targets) points at an HLS manifest.
 * Used to avoid feeding HTML/embed gateways into Hls.js or Safari native HLS incorrectly.
 */
export function isLikelyHlsManifestUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  if (isStreamDirectHlsDelivery(url)) {
    return true
  }

  const lower = url.toLowerCase()
  if (lower.includes('.m3u8') || lower.includes('.m3u')) {
    return true
  }

  try {
    const parsed = new URL(url, 'http://localhost')
    const inner = parsed.searchParams.get('url')
    if (!inner) {
      return false
    }

    const decoded = decodeURIComponent(inner).toLowerCase()
    return decoded.includes('.m3u8') || decoded.includes('.m3u')
  } catch {
    return false
  }
}
