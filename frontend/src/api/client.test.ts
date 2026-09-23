import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, setSessionExpiredHandler } from './client'

const BASE = 'http://localhost:8080/api/v1'

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function problem(status: number, extra: Record<string, unknown> = {}): Response {
  return json(
    status,
    { type: 'https://revisor.dev/errors/x', title: 'Title', status, detail: 'Detail text', instance: '/x', ...extra },
    { 'Content-Type': 'application/problem+json', 'X-Request-Id': 'req-123' },
  )
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  setSessionExpiredHandler(null)
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Every call as [url, init], in order. */
function calls(): Array<[string, RequestInit]> {
  return fetchMock.mock.calls.map(([input, init]) => [String(input), init ?? {}])
}

describe('request building', () => {
  it('sends credentialed JSON GETs to /api/v1 and parses the body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 1 }))

    const result = await apiFetch<{ id: number }>('/courses/1')

    expect(result).toEqual({ id: 1 })
    const [url, init] = calls()[0]
    expect(url).toBe(`${BASE}/courses/1`)
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    expect(init.body).toBeUndefined()
  })

  it('serializes a body as JSON and labels it', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { id: 5 }))

    await apiFetch('/courses', { method: 'POST', body: { title: 'System Design' } })

    const [, init] = calls()[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"title":"System Design"}')
    expect(init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
  })

  it('appends query params, dropping undefined and null ones and encoding the rest', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))

    await apiFetch('/admin/users', { query: { q: 'ann & bob', page: 0, size: undefined, range: null } })

    expect(calls()[0][0]).toBe(`${BASE}/admin/users?q=ann+%26+bob&page=0`)
  })

  it('omits the "?" entirely when there are no usable params', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))

    await apiFetch('/courses', { query: { page: undefined } })

    expect(calls()[0][0]).toBe(`${BASE}/courses`)
  })

  it('honours VITE_API_URL and tolerates a trailing slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/')
    fetchMock.mockResolvedValueOnce(json(200, {}))

    await apiFetch('/courses')

    expect(calls()[0][0]).toBe('https://api.example.test/api/v1/courses')
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(apiFetch<void>('/courses/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('errors', () => {
  it('turns a Problem Details response into an ApiError carrying the problem and request id', async () => {
    fetchMock.mockResolvedValueOnce(problem(409, { detail: 'User 2 must be disabled first' }))

    const error = await apiFetch('/admin/users/2', { method: 'DELETE' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(409)
    expect(apiError.message).toBe('User 2 must be disabled first')
    expect(apiError.problem?.title).toBe('Title')
    expect(apiError.requestId).toBe('req-123')
    expect(apiError.fieldErrors).toEqual({})
  })

  it('exposes validation errors by field, keeping the first message per field', async () => {
    fetchMock.mockResolvedValueOnce(
      problem(400, {
        errors: [
          { field: 'title', message: 'must not be blank' },
          { field: 'title', message: 'size must be between 1 and 255' },
          { field: 'password', message: 'size must be between 8 and 72' },
        ],
      }),
    )

    const error = (await apiFetch('/courses', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError

    expect(error.fieldErrors).toEqual({
      title: 'must not be blank',
      password: 'size must be between 8 and 72',
    })
  })

  it('falls back to a generic message when the error body is not JSON (e.g. a proxy 502 page)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = (await apiFetch('/courses').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.message).toBe('Request failed (HTTP 502)')
    expect(error.problem).toBeNull()
  })

  it('survives a JSON content type with an unparseable body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not json', { status: 500, headers: { 'Content-Type': 'application/json' } }),
    )

    const error = (await apiFetch('/courses').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(500)
    expect(error.problem).toBeNull()
  })

  it('reports an unreachable server as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = (await apiFetch('/courses').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/could not reach the server/i)
  })

  it('lets an aborted request through untouched, so callers can tell cancellation from failure', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValueOnce(abort)

    await expect(apiFetch('/courses')).rejects.toBe(abort)
  })
})

describe('token refresh on 401', () => {
  /**
   * A fake backend with one piece of state: whether the access cookie is currently valid.
   * Any non-auth request 401s until /auth/refresh has run.
   */
  function fakeBackend(options: { refresh: 'ok' | 'rejected' | 'unreachable' }) {
    let accessValid = false
    const log: string[] = []
    fetchMock.mockImplementation(async (input) => {
      const path = String(input).replace(BASE, '')
      log.push(path)
      if (path === '/auth/refresh') {
        if (options.refresh === 'unreachable') throw new TypeError('Failed to fetch')
        if (options.refresh === 'rejected') return problem(401)
        accessValid = true
        return json(200, { user: { id: 1, name: 'Ann', email: 'ann@example.com', role: 'USER' } })
      }
      if (path === '/auth/login') return problem(401)
      return accessValid ? json(200, { ok: true }) : problem(401)
    })
    return { log }
  }

  it('refreshes once and transparently retries the original request', async () => {
    const { log } = fakeBackend({ refresh: 'ok' })

    await expect(apiFetch('/courses')).resolves.toEqual({ ok: true })

    expect(log).toEqual(['/courses', '/auth/refresh', '/courses'])
  })

  it('shares ONE refresh between concurrent 401s — a second would replay a rotated token and get the session revoked', async () => {
    const { log } = fakeBackend({ refresh: 'ok' })

    const results = await Promise.all([apiFetch('/courses'), apiFetch('/dashboard/summary'), apiFetch('/topics/1')])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(log.filter((path) => path === '/auth/refresh')).toHaveLength(1)
  })

  it('can refresh again later, once the previous refresh has finished (the in-flight slot is released)', async () => {
    fakeBackend({ refresh: 'ok' })
    await apiFetch('/courses')

    // The access token lapses again 15 minutes later: a fresh fake backend that 401s until refreshed.
    fakeBackend({ refresh: 'ok' })
    await apiFetch('/courses')

    const refreshCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh'))
    expect(refreshCalls).toHaveLength(2)
  })

  it('when the refresh token is rejected: notifies the session-expired handler once, does not retry, and surfaces the 401', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    const { log } = fakeBackend({ refresh: 'rejected' })

    const outcomes = await Promise.allSettled([apiFetch('/courses'), apiFetch('/dashboard/summary')])

    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected')
      expect((outcome as PromiseRejectedResult).reason).toMatchObject({ status: 401 })
    }
    expect(onExpired).toHaveBeenCalledTimes(1)
    // Two original requests + one shared refresh; nothing retried.
    expect(log).toHaveLength(3)
  })

  it('does not end the session when the refresh merely could not reach the server', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    fakeBackend({ refresh: 'unreachable' })

    await expect(apiFetch('/courses')).rejects.toMatchObject({ status: 401 })

    expect(onExpired).not.toHaveBeenCalled()
  })

  it('gives up after one retry rather than looping when the retried request 401s again', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/auth/refresh') ? json(200, { user: {} }) : problem(401),
    )

    await expect(apiFetch('/courses')).rejects.toMatchObject({ status: 401 })

    expect(fetchMock).toHaveBeenCalledTimes(3) // original, refresh, one retry
  })

  it.each(['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'])(
    'never refreshes on a 401 from %s — there it just means bad credentials or no session',
    async (path) => {
      const onExpired = vi.fn()
      setSessionExpiredHandler(onExpired)
      fetchMock.mockResolvedValue(problem(401))

      await expect(apiFetch(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(onExpired).not.toHaveBeenCalled()
    },
  )

  it('does not refresh for errors other than 401', async () => {
    fetchMock.mockResolvedValue(problem(403))

    await expect(apiFetch('/admin/users')).rejects.toMatchObject({ status: 403 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
