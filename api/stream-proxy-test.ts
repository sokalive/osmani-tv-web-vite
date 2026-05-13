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

async function handle(request: Request) {
  const requestUrl = new URL(request.url)
  const target = pickParam(requestUrl, 'url')
  const responseHeaders = new Headers({ 'content-type': 'text/plain; charset=utf-8' })
  setCors(responseHeaders)

  if (!target || !isProbablyHttpUrl(target)) {
    return new Response('Missing or invalid url query param', { status: 400, headers: responseHeaders })
  }

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

  const cookieJar = new Map<string, string>()
  try {
    const upstream = await fetchWithRedirects(target, headers, MAX_REDIRECTS, cookieJar)
    const bytes = await upstream.arrayBuffer()
    const sample = new TextDecoder().decode(bytes.slice(0, 400))

    return new Response(
      [
        `target: ${target}`,
        `finalUrl: ${upstream.finalUrl}`,
        `status: ${upstream.status}`,
        `content-type: ${upstream.headers.get('content-type') || ''}`,
        `bytes: ${bytes.byteLength}`,
        `cookies: ${cookieJar.size}`,
        '--- first 400 chars ---',
        sample,
      ].join('\n'),
      {
        status: upstream.ok ? 200 : upstream.status,
        headers: responseHeaders,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upstream error'
    return new Response(`error: ${message}`, { status: 502, headers: responseHeaders })
  }
}

export const GET = handle

export async function OPTIONS() {
  const headers = new Headers()
  setCors(headers)
  return new Response(null, { status: 204, headers })
}

