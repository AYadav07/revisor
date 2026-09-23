import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'

const MAX_RETRIES = 2

/**
 * Retry transient failures (server unreachable, 5xx) but never client errors: a 4xx —
 * including a 401 that a token refresh already failed to fix — fails identically every
 * time, so retrying only delays the error the user needs to see.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < MAX_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is treated as fresh briefly so navigating between pages doesn't refetch on
        // every mount, while refetch-on-focus still keeps the dashboard current.
        staleTime: 30_000,
        retry: shouldRetry,
      },
      // Mutations are user actions with side effects (review, delete): never silently repeat them.
      mutations: { retry: false },
    },
  })
}
