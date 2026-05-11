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

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const withJsonHeaders = (init: RequestInit = {}) => {
  const headers = new Headers(init.headers)

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    ...init,
    headers,
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
    init: RequestInit = {},
  ): Promise<T> => {
    if (!baseUrl) {
      throw new Error(`${serviceName} base URL is not configured.`)
    }

    const url = new URL(path.replace(/^\//, ''), `${baseUrl}/`)
    const response = await fetch(url, withJsonHeaders(init))
    return parseResponse<T>(response)
  }

  return {
    get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
    post: <T>(path: string, body?: JsonValue, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  }
}
