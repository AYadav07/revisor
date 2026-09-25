import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authApi, setSessionExpiredHandler } from '@/api'
import { ann } from '@/test/auth'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    authApi: { signup: vi.fn(), login: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
    setSessionExpiredHandler: vi.fn(),
  }
})
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

const api = vi.mocked(authApi)
const registerHandler = vi.mocked(setSessionExpiredHandler)

let queryClient: QueryClient

beforeEach(() => {
  vi.clearAllMocks()
  api.refresh.mockRejectedValue(new ApiError(401, 'no session')) // default: nobody signed in
  queryClient = new QueryClient()
})

function setup(options: { strict?: boolean } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
    return options.strict ? <StrictMode>{tree}</StrictMode> : tree
  }
  return renderHook(() => useAuth(), { wrapper })
}

/** The session-expired handler the provider most recently registered with the API client. */
function expiredHandler(): () => void {
  const handler = registerHandler.mock.calls.filter(([h]) => h !== null).at(-1)?.[0]
  if (!handler) throw new Error('provider did not register a session-expired handler')
  return handler
}

describe('session restore on load', () => {
  it('starts in loading, then settles as unauthenticated when there is no session', async () => {
    const { result } = setup()
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(result.current.user).toBeNull()
  })

  it('restores the signed-in user from the refresh cookie', async () => {
    api.refresh.mockResolvedValue({ user: ann })

    const { result } = setup()

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.user).toEqual(ann)
  })

  it('treats a server that is down as signed out rather than hanging on the loading screen', async () => {
    api.refresh.mockRejectedValue(new ApiError(0, 'offline'))

    const { result } = setup()

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
  })

  it('makes exactly ONE refresh request even under StrictMode, which runs effects twice', async () => {
    api.refresh.mockResolvedValue({ user: ann })

    const { result } = setup({ strict: true })

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    // Two would mean the second replays a rotated token, the backend reads that as theft, and the
    // session is revoked: a developer would be signed out on every reload.
    expect(api.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('login / signup / logout', () => {
  it('login signs the user in and clears the query cache', async () => {
    api.login.mockResolvedValue({ user: ann })
    const clear = vi.spyOn(queryClient, 'clear')
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await act(() => result.current.login({ email: ann.email, password: 'pw' }))

    expect(api.login).toHaveBeenCalledWith({ email: ann.email, password: 'pw' })
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(ann)
    expect(clear).toHaveBeenCalled()
  })

  it('a failed login leaves the user signed out and rejects with the error', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'Invalid credentials'))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await expect(act(() => result.current.login({ email: 'a@b.co', password: 'x' }))).rejects.toMatchObject({
      status: 401,
    })

    expect(result.current.status).toBe('unauthenticated')
  })

  it('signup creates the account, then signs in with the same credentials (signup itself sets no cookies)', async () => {
    api.signup.mockResolvedValue(ann)
    api.login.mockResolvedValue({ user: ann })
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await act(() =>
      result.current.signup({ name: 'Ann', email: ann.email, password: 'correct-horse', timezone: 'Asia/Kolkata' }),
    )

    expect(api.signup).toHaveBeenCalledWith({
      name: 'Ann',
      email: ann.email,
      password: 'correct-horse',
      timezone: 'Asia/Kolkata',
    })
    expect(api.login).toHaveBeenCalledWith({ email: ann.email, password: 'correct-horse' })
    expect(api.signup.mock.invocationCallOrder[0]).toBeLessThan(api.login.mock.invocationCallOrder[0])
    expect(result.current.status).toBe('authenticated')
  })

  it('a failed signup never attempts a login', async () => {
    api.signup.mockRejectedValue(new ApiError(409, 'exists'))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await expect(
      act(() => result.current.signup({ name: 'A', email: 'a@b.co', password: 'correct-horse', timezone: 'UTC' })),
    ).rejects.toMatchObject({ status: 409 })

    expect(api.login).not.toHaveBeenCalled()
  })

  it('logout signs out and clears the query cache', async () => {
    api.refresh.mockResolvedValue({ user: ann })
    api.logout.mockResolvedValue(undefined)
    const clear = vi.spyOn(queryClient, 'clear')
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    await act(() => result.current.logout())

    expect(api.logout).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
    expect(clear).toHaveBeenCalled()
  })

  it('logout still signs out locally when the server call fails, but reports the failure', async () => {
    api.refresh.mockResolvedValue({ user: ann })
    api.logout.mockRejectedValue(new ApiError(0, 'offline'))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    // The rejection is captured *inside* act: React drops the render queued by an act() callback that
    // itself rejects, which would make this look like a provider bug when it's a test artifact.
    let failure: unknown
    await act(async () => {
      failure = await result.current.logout().then(() => undefined, (error: unknown) => error)
    })

    expect(failure).toMatchObject({ status: 0 })
    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
  })
})

describe('session expiry', () => {
  it('signs the user out, clears the cache and says why when the API client reports an expired session', async () => {
    api.refresh.mockResolvedValue({ user: ann })
    const clear = vi.spyOn(queryClient, 'clear')
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => expiredHandler()())

    expect(result.current.status).toBe('unauthenticated')
    expect(clear).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('Your session expired. Please sign in again.')
  })

  it('ignores an "expired" report when nobody is signed in — e.g. a request that outlived a deliberate sign-out', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    act(() => expiredHandler()())

    expect(toast.info).not.toHaveBeenCalled()
  })

  it('unregisters its handler on unmount', async () => {
    const { unmount } = setup()

    unmount()

    expect(registerHandler).toHaveBeenLastCalledWith(null)
  })
})

describe('useAuth', () => {
  it('refuses to work outside an AuthProvider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>')

    error.mockRestore()
  })
})
