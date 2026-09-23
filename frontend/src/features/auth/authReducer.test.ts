import { describe, expect, it } from 'vitest'
import { ann } from '@/test/auth'
import { authReducer, initialAuthState } from './authReducer'

describe('authReducer', () => {
  it('starts in loading, with no user, until the first session restore finishes', () => {
    expect(initialAuthState).toEqual({ status: 'loading', user: null })
  })

  it('signed-in stores the user, from any state', () => {
    for (const from of [initialAuthState, { status: 'unauthenticated', user: null } as const]) {
      expect(authReducer(from, { type: 'signed-in', user: ann })).toEqual({ status: 'authenticated', user: ann })
    }
  })

  it('signed-out drops the user, from any state', () => {
    for (const from of [initialAuthState, { status: 'authenticated', user: ann } as const]) {
      expect(authReducer(from, { type: 'signed-out' })).toEqual({ status: 'unauthenticated', user: null })
    }
  })
})
