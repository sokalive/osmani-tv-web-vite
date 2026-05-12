/**
 * Detect whether a URL (including stream-proxy `?url=` targets) points at an HLS manifest.
 * Used to avoid feeding HTML/embed gateways into Hls.js or Safari native HLS incorrectly.
 */
export function isLikelyHlsManifestUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
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
