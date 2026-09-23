import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import { createQueryClient, shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 429])('never retries a %i — it would fail identically', (status) => {
    expect(shouldRetry(0, new ApiError(status, 'nope'))).toBe(false)
  })

  it.each([500, 502, 503])('retries a %i (transient server trouble)', (status) => {
    expect(shouldRetry(0, new ApiError(status, 'oops'))).toBe(true)
  })

  it('retries an unreachable server (status 0)', () => {
    expect(shouldRetry(0, new ApiError(0, 'offline'))).toBe(true)
  })

  it('retries unexpected non-API errors too, since they are not known-permanent', () => {
    expect(shouldRetry(0, new TypeError('boom'))).toBe(true)
  })

  it('stops after two retries', () => {
    const transient = new ApiError(503, 'down')
    expect(shouldRetry(0, transient)).toBe(true)
    expect(shouldRetry(1, transient)).toBe(true)
    expect(shouldRetry(2, transient)).toBe(false)
  })
})

describe('createQueryClient', () => {
  it('uses the retry policy for queries, and never retries mutations', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions()

    expect(queries?.retry).toBe(shouldRetry)
    expect(mutations?.retry).toBe(false)
  })

  it('returns an independent client each time, so tests and features never share cache', () => {
    expect(createQueryClient()).not.toBe(createQueryClient())
  })
})
