import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authApi } from '@/api'
import { ann } from '@/test/auth'
import { restoreSession } from './restoreSession'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, authApi: { refresh: vi.fn() } }
})

const refresh = vi.mocked(authApi.refresh)

// Braces matter: an arrow that *returns* the mock would be run by Vitest as a teardown callback.
beforeEach(() => {
  refresh.mockReset()
})

describe('restoreSession', () => {
  it('resolves to the user when the refresh cookie is still good', async () => {
    refresh.mockResolvedValue({ user: ann })

    await expect(restoreSession()).resolves.toEqual(ann)
  })

  it('resolves to null when there is no valid session (401)', async () => {
    refresh.mockRejectedValue(new ApiError(401, 'Invalid refresh token'))

    await expect(restoreSession()).resolves.toBeNull()
  })

  it('rejects for anything else, since "server down" is not "signed out"', async () => {
    refresh.mockRejectedValue(new ApiError(503, 'unavailable'))

    await expect(restoreSession()).rejects.toMatchObject({ status: 503 })
  })

  it('shares one request between concurrent callers — a second refresh would replay a rotated token', async () => {
    refresh.mockResolvedValue({ user: ann })

    const [a, b] = await Promise.all([restoreSession(), restoreSession()])

    expect(a).toEqual(ann)
    expect(b).toEqual(ann)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('makes a fresh request once the previous one has settled', async () => {
    refresh.mockResolvedValue({ user: ann })

    await restoreSession()
    await restoreSession()

    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
