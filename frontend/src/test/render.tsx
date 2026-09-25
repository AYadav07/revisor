import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

/** A query client for tests: no retries, so a failing request fails at once instead of after backoff. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renders `ui` inside a fresh QueryClient and a MemoryRouter starting at `route`. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = createTestQueryClient() }: { route?: string; queryClient?: QueryClient } = {},
) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient, user: userEvent.setup() }
}
