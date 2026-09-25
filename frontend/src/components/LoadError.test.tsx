import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadError } from './LoadError'

describe('LoadError', () => {
  it('says what failed and retries on request', async () => {
    const onRetry = vi.fn()
    render(<LoadError message="Couldn't load it." onRetry={onRetry} retrying={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load it.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables the retry while one is running', () => {
    render(<LoadError message="x" onRetry={vi.fn()} retrying />)

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  })
})
