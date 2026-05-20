const DEFAULT_TARGET_ORIGIN = 'https://osmani-admin-api.onrender.com'

const PROXY_PATH_PREFIXES = [
  '/api/osmani-admin-payment-proxy',
  '/osmani-admin-payment-proxy',
]

const STRIPPED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'x-vercel-forwarded-for',
  'x-vercel-id',
])

function targetOrigin() {
  const configured = process.env.OSMANI_ADMIN_API_ORIGIN?.trim()
  return (configured || DEFAULT_TARGET_ORIGIN).replace(/\/+$/, '')
}

function resolveUpstreamPath(url: URL) {
  const queryPath = url.searchParams.get('path')?.trim()
  if (queryPath) {
    url.searchParams.delete('path')
    return queryPath.replace(/^\/+/, '')
  }

  for (const prefix of PROXY_PATH_PREFIXES) {
    if (url.pathname === prefix) {
      return ''
    }

    if (url.pathname.startsWith(`${prefix}/`)) {
      return url.pathname.slice(prefix.length).replace(/^\/+/, '')
    }
  }

  return ''
}

function buildTargetUrl(request: Request) {
  const url = new URL(request.url)
  const upstreamPath = resolveUpstreamPath(url)

  if (!upstreamPath) {
    return null
  }

  const targetUrl = new URL(`/${upstreamPath}`, `${targetOrigin()}/`)
  const search = url.searchParams.toString()

  if (search) {
    targetUrl.search = search
  }

  return targetUrl
}

function forwardHeaders(request: Request) {
  const headers = new Headers()

  for (const [key, value] of request.headers.entries()) {
    if (STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      continue
    }

    headers.set(key, value)
  }

  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }

  return headers
}

async function handle(request: Request) {
  const method = request.method.toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await request.text() : undefined
  const targetUrl = buildTargetUrl(request)

  if (!targetUrl) {
    return Response.json(
      {
        error:
          'Missing upstream path. Use /osmani-admin-payment-proxy/<api-path> or ?path=<api-path>.',
      },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders(request),
      body: body && body.length > 0 ? body : undefined,
      redirect: 'manual',
    })

    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')

    const responseBody = await upstream.arrayBuffer()

    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Origin-safe proxy failed'
    return Response.json(
      {
        error: message,
      },
      {
        status: 502,
      },
    )
  }
}

export const GET = handle
export const POST = handle
