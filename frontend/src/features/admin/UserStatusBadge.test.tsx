import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserStatusBadge } from './UserStatusBadge'

describe('UserStatusBadge', () => {
  it('shows Active in the success color for an enabled user', () => {
    render(<UserStatusBadge enabled />)

    expect(screen.getByText('Active')).toHaveClass('bg-success')
  })

  it('shows Disabled in the destructive color for a disabled user', () => {
    render(<UserStatusBadge enabled={false} />)

    expect(screen.getByText('Disabled')).toHaveClass('bg-destructive')
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('adds an Unverified warning for an enabled user who has not verified their email', () => {
    render(<UserStatusBadge enabled emailVerified={false} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Unverified')).toHaveClass('bg-warning')
  })

  it('shows no Unverified badge once the email is verified, or for a disabled user', () => {
    const { rerender } = render(<UserStatusBadge enabled emailVerified />)
    expect(screen.queryByText('Unverified')).not.toBeInTheDocument()

    rerender(<UserStatusBadge enabled={false} emailVerified={false} />)
    expect(screen.queryByText('Unverified')).not.toBeInTheDocument()
  })
})
