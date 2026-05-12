import { env } from '../config/env'
import { getSessionToken } from '../services/auth/session'

export class ApiError extends Error {
  public readonly status: number
  public readonly responseBody: string

  constructor(
    message: string,
    status: number,
    responseBody: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.responseBody = responseBody
  }
}

type ApiClientOptions = {
  baseUrl: string
  serviceName: string
}

type ApiRequestInit = RequestInit & {
  timeoutMs?: number
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

function resolveBaseUrl(rawBaseUrl: string) {
  if (/^https?:\/\//i.test(rawBaseUrl)) {
    return rawBaseUrl
  }

  if (typeof window !== 'undefined') {
    return new URL(rawBaseUrl, window.location.origin).toString()
  }

  return `http://localhost${rawBaseUrl.startsWith('/') ? rawBaseUrl : `/${rawBaseUrl}`}`
}

const withJsonHeaders = (init: ApiRequestInit = {}) => {
  const headers = new Headers(init.headers)
  const token = getSessionToken()
  const method = String(init.method || 'GET').toUpperCase()

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    ...init,
    cache: init.cache ?? (method === 'GET' ? 'no-store' : undefined),
    credentials: init.credentials ?? (env.useCredentials ? 'include' : 'same-origin'),
    headers,
  }
}

function createRequestSignal(init: ApiRequestInit, serviceName: string) {
  const timeoutMs =
    typeof init.timeoutMs === 'number' && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0
      ? init.timeoutMs
      : 0
  const externalSignal = init.signal

  if (!timeoutMs && !externalSignal) {
    return {
      signal: undefined as AbortSignal | undefined,
      didTimeout: () => false,
      cleanup: () => undefined,
    }
  }

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null
  let timedOut = false
  const controller = new AbortController()
  const abortFromExternal = () => controller.abort(externalSignal?.reason)

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason)
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true })
    }
  }

  if (timeoutMs > 0) {
    timeoutId = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort(new Error(`${serviceName} request timed out`))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId)
      }
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortFromExternal)
      }
    },
  }
}

async function parseResponse<T>(response: Response) {
  if (response.status === 204) {
    return undefined as T
  }

  const raw = await response.text()

  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      raw,
    )
  }

  if (!raw) {
    return undefined as T
  }

  return JSON.parse(raw) as T
}

export function createApiClient({ baseUrl, serviceName }: ApiClientOptions) {
  const request = async <T>(
    path: string,
    init: ApiRequestInit = {},
  ): Promise<T> => {
    if (!baseUrl) {
      throw new Error(`${serviceName} base URL is not configured.`)
    }

    const url = new URL(
      path.replace(/^\//, ''),
      `${resolveBaseUrl(baseUrl).replace(/\/+$/, '')}/`,
    )
    const normalizedInit = withJsonHeaders(init)
    const { timeoutMs: _timeoutMs, ...fetchInit } = normalizedInit
    const requestSignal = createRequestSignal(normalizedInit, serviceName)

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: requestSignal.signal,
      })
      return parseResponse<T>(response)
    } catch (error) {
      if (requestSignal.didTimeout()) {
        throw new Error(`${serviceName} request timed out`, { cause: error })
      }
      throw error
    } finally {
      requestSignal.cleanup()
    }
  }

  return {
    get: <T>(path: string, init?: ApiRequestInit) => request<T>(path, init),
    post: <T>(path: string, body?: JsonValue, init?: ApiRequestInit) =>
      request<T>(path, {
        ...init,
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    put: <T>(path: string, body?: JsonValue, init?: ApiRequestInit) =>
      request<T>(path, {
        ...init,
        method: 'PUT',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  }
}
