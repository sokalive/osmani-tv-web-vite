const TARGET_ORIGIN = 'https://osmani-admin-api.onrender.com'

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

function buildTargetUrl(request: Request) {
  const url = new URL(request.url)
  const proxiedPath = url.pathname.replace(/^\/api\/osmani-admin-payment-proxy/, '')
  return new URL(`${proxiedPath}${url.search}`, TARGET_ORIGIN)
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

export default {
  async fetch(request: Request) {
    const targetUrl = buildTargetUrl(request)
    const method = request.method.toUpperCase()
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody ? await request.text() : undefined

    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers: forwardHeaders(request),
        body: body && body.length > 0 ? body : undefined,
        redirect: 'manual',
      })

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment proxy failed'
      return Response.json(
        {
          error: message,
        },
        {
          status: 502,
        },
      )
    }
  },
}
