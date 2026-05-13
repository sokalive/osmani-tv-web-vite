const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'

const MAX_REDIRECTS = 6
const UPSTREAM_TIMEOUT_MS = 30_000

function pickParam(url: URL, ...keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key)
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function isProbablyHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isManifestPath(url: string) {
  const cleaned = String(url).split(/[?#]/)[0].toLowerCase()
  return cleaned.endsWith('.m3u8') || cleaned.endsWith('.m3u')
}

function isManifestContentType(contentType: string | null) {
  const lowered = String(contentType || '').toLowerCase()
  return lowered.includes('mpegurl') || lowered.includes('x-mpegurl')
}

function setCors(headers: Headers) {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set('Access-Control-Expose-Headers', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

function mergeCookieJar(jar: Map<string, string>, setCookie: string | null) {
  if (!setCookie) return
  const first = setCookie.split(';')[0]
  const [name, ...rest] = first.split('=')
  const key = name?.trim()
  if (!key) return
  jar.set(key, rest.join('=').trim())
}

async function fetchWithRedirects(
  targetUrl: string,
  headers: Headers,
  redirectsLeft: number,
  cookieJar: Map<string, string>,
): Promise<Response & { finalUrl: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const cookieHeader = [...cookieJar.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    if (cookieHeader) {
      headers.set('cookie', cookieHeader)
    } else {
      headers.delete('cookie')
    }

    const response = (await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    })) as Response & { finalUrl?: string }

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      // Many platforms concatenate multiple Set-Cookie headers; this is a best-effort jar.
      setCookie.split(/,(?=[^;]+=[^;]+)/).forEach((part) => mergeCookieJar(cookieJar, part))
    }

    if (
      response.status >= 300 &&
      response.status < 400 &&
      redirectsLeft > 0 &&
      response.headers.get('location')
    ) {
      const location = response.headers.get('location') || ''
      response.body?.cancel?.().catch(() => null)
      const next = new URL(location, targetUrl).toString()
      return fetchWithRedirects(next, headers, redirectsLeft - 1, cookieJar)
    }

    response.finalUrl = targetUrl
    return response as Response & { finalUrl: string }
  } finally {
    clearTimeout(timeout)
  }
}

function buildProxyQuery(target: string, requestUrl: URL) {
  const params = new URLSearchParams()
  params.set('url', target)

  const ua = pickParam(requestUrl, 'ua', 'userAgent')
  if (ua) {
    params.set('ua', ua)
    params.set('userAgent', ua)
  }

  const referer = pickParam(requestUrl, 'referer', 'referrer')
  if (referer) {
    params.set('referer', referer)
    params.set('referrer', referer)
  }

  const origin = pickParam(requestUrl, 'origin')
  if (origin) {
    params.set('origin', origin)
  }

  return params.toString()
}

function rewriteManifest(manifestText: string, finalUrl: string, requestUrl: URL) {
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => {
          const abs = new URL(u, finalUrl).toString()
          return `URI="/stream-proxy?${buildProxyQuery(abs, requestUrl)}"`
        })
      }
      const abs = new URL(trimmed, finalUrl).toString()
      return `/stream-proxy?${buildProxyQuery(abs, requestUrl)}`
    })
    .join('\n')
}

async function handle(request: Request) {
  const requestUrl = new URL(request.url)

  const headers = new Headers()
  headers.set('accept', '*/*')
  headers.set('accept-encoding', 'identity')

  const ua = pickParam(requestUrl, 'ua', 'userAgent')
  headers.set('user-agent', ua || DEFAULT_UA)

  const referer = pickParam(requestUrl, 'referer', 'referrer')
  if (referer && isProbablyHttpUrl(referer)) {
    headers.set('referer', referer)
  }

  const origin = pickParam(requestUrl, 'origin')
  if (origin && isProbablyHttpUrl(origin)) {
    headers.set('origin', origin)
  }

  const target = pickParam(requestUrl, 'url')
  if (!target || !isProbablyHttpUrl(target)) {
    const responseHeaders = new Headers({ 'content-type': 'text/plain; charset=utf-8' })
    setCors(responseHeaders)
    return new Response('Missing or invalid url query param', { status: 400, headers: responseHeaders })
  }

  const cookieJar = new Map<string, string>()
  let upstream: (Response & { finalUrl: string }) | null = null
  try {
    upstream = await fetchWithRedirects(target, headers, MAX_REDIRECTS, cookieJar)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upstream error'
    const responseHeaders = new Headers({ 'content-type': 'text/plain; charset=utf-8' })
    setCors(responseHeaders)
    return new Response(`Upstream error: ${message}`, { status: 502, headers: responseHeaders })
  }

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')
  responseHeaders.delete('transfer-encoding')
  responseHeaders.delete('set-cookie')

  setCors(responseHeaders)
  responseHeaders.set('cache-control', 'no-store')

  const contentType = upstream.headers.get('content-type')
  const looksLikeManifest = isManifestPath(upstream.finalUrl) || isManifestContentType(contentType)

  if (looksLikeManifest) {
    const text = await upstream.text()
    const rewritten = rewriteManifest(text, upstream.finalUrl, requestUrl)
    responseHeaders.set('content-type', 'application/vnd.apple.mpegurl; charset=utf-8')
    return new Response(rewritten, {
      status: upstream.ok ? 200 : upstream.status,
      headers: responseHeaders,
    })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const GET = handle

export async function OPTIONS() {
  const headers = new Headers()
  setCors(headers)
  return new Response(null, { status: 204, headers })
}

