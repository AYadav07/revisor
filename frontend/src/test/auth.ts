import { vi } from 'vitest'
import type { AuthUser } from '@/api'
import type { AuthContextValue } from '@/features/auth/AuthContext'

export const ann: AuthUser = { id: 1, name: 'Ann', email: 'ann@example.com', role: 'USER' }

/** An auth context value for tests that don't need the real provider; every action is a mock. */
export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'unauthenticated',
    user: null,
    login: vi.fn().mockResolvedValue(ann),
    signup: vi.fn().mockResolvedValue(ann),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
