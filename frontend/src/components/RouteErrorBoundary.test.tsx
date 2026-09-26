import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function Boom({ fail }: { fail: boolean }) {
  if (fail) throw new Error('chunk failed')
  return <p>the page</p>
}

const reload = vi.fn()
const realLocation = window.location

beforeEach(() => {
  // React logs every caught render error; that noise isn't what these tests are about.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reload.mockClear()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } })
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

describe('RouteErrorBoundary', () => {
  it('renders its children when nothing is wrong', () => {
    render(
      <RouteErrorBoundary resetKey="/a">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    )

    expect(screen.getByText('the page')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('replaces a failing page with a message and a way to reload', async () => {
    render(
      <RouteErrorBoundary resetKey="/a">
        <Boom fail />
      </RouteErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload page' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('gives the next page a fresh start when the user navigates away', () => {
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/a">
        <Boom fail />
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    rerender(
      <RouteErrorBoundary resetKey="/b">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    )

    expect(screen.getByText('the page')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('stays on the message while the user is still on the same page', () => {
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/a">
        <Boom fail />
      </RouteErrorBoundary>,
    )

    rerender(
      <RouteErrorBoundary resetKey="/a">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
