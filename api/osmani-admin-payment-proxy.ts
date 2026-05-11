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
  const rawPath = url.searchParams.get('path') || ''

  url.searchParams.delete('path')

  const targetUrl = new URL(`/${rawPath.replace(/^\/+/, '')}`, TARGET_ORIGIN)
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

  try {
    const upstream = await fetch(buildTargetUrl(request), {
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
