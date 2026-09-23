import type { ProblemDetail } from './types'

/**
 * The single place the app talks HTTP to the backend (ARCHITECTURE.md §8): every request goes
 * through {@link apiFetch}, so cookies, JSON handling, error shape and token refresh are
 * implemented exactly once.
 */

const API_PREFIX = '/api/v1'
const DEFAULT_BASE_URL = 'http://localhost:8080'

// Read per call rather than at import time so tests (and nothing else) can vary it.
function baseUrl(): string {
  return (import.meta.env.VITE_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/** A non-2xx response, or a request that never got one (`status` 0). */
export class ApiError extends Error {
  readonly status: number
  /** The RFC 7807 body, when the server sent one. */
  readonly problem: ProblemDetail | null
  /** The server's `X-Request-Id`, to quote when reporting a problem (matches its logs). */
  readonly requestId: string | null

  constructor(
    status: number,
    message: string,
    problem: ProblemDetail | null = null,
    requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.requestId = requestId
  }

  /**
   * Server-side validation errors keyed by field name (first message per field), ready to
   * feed onto react-hook-form fields via `setError`. Empty for any non-validation error.
   */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const { field, message } of this.problem?.errors ?? []) {
      result[field] ??= message
    }
    return result
  }
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialized as JSON. */
  body?: unknown
  /** `undefined`/`null` entries are dropped, so callers can pass optional params straight through. */
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

// ---- Session expiry -------------------------------------------------------------------------

type SessionExpiredHandler = () => void

let sessionExpiredHandler: SessionExpiredHandler | null = null

/**
 * Registers what happens when the session is genuinely over — a 401 that a token refresh
 * could not fix (the refresh token itself was rejected). The auth layer sets this to clear
 * the current user and send them to /login. Called at most once per failed refresh.
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
}

// The access token lives 15 minutes; when it lapses the first request 401s and we refresh.
// Single-flight: N requests that 401 together share ONE refresh call. That matters beyond
// efficiency — refresh tokens rotate, so a second concurrent refresh would present an
// already-rotated token, which the backend treats as theft and answers by revoking the whole
// session (SECURITY.md, "Reuse of a revoked token revokes the whole family").
let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= attemptRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function attemptRefresh(): Promise<boolean> {
  let response: Response
  try {
    response = await fetch(url('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // Server unreachable: we can't tell whether the session is still good, so don't end it.
    return false
  }
  if (response.ok) {
    return true
  }
  if (response.status === 401) {
    sessionExpiredHandler?.()
  }
  return false
}

// ---- Requests -------------------------------------------------------------------------------

function url(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  }
  const queryString = params.toString()
  return `${baseUrl()}${API_PREFIX}${path}${queryString ? `?${queryString}` : ''}`
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: string | undefined
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  try {
    return await fetch(url(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      // Required for the httpOnly auth cookies to be sent (SECURITY.md, ARCHITECTURE.md §8).
      credentials: 'include',
      signal: options.signal,
    })
  } catch (error) {
    // A cancelled request isn't a failure — TanStack Query aborts superseded ones — so pass it through.
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('X-Request-Id')
  let problem: ProblemDetail | null = null
  if ((response.headers.get('Content-Type') ?? '').includes('json')) {
    try {
      problem = (await response.json()) as ProblemDetail
    } catch {
      problem = null
    }
  }
  const message = problem?.detail || problem?.title || `Request failed (HTTP ${response.status})`
  return new ApiError(response.status, message, problem, requestId)
}

/**
 * Calls `/api/v1{path}` and returns the parsed JSON body (`undefined` for 204).
 *
 * A 401 on any non-auth endpoint triggers one token refresh and one retry of the original
 * request. Auth endpoints are exempt: a 401 from `/auth/login` just means bad credentials.
 *
 * @throws ApiError for any non-2xx response, or `status` 0 when the server is unreachable.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      response = await send(path, options)
    }
  }

  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
