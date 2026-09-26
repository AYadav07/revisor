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
})
