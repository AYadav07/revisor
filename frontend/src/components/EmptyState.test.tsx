import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'
import { PageHeader } from './PageHeader'

describe('EmptyState', () => {
  it('says what is missing and offers the next step', () => {
    render(<EmptyState title="No courses yet" description="Create one." action={<button>New course</button>} />)

    expect(screen.getByText('No courses yet')).toBeInTheDocument()
    expect(screen.getByText('Create one.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New course' })).toBeInTheDocument()
  })

  it('works without an action', () => {
    render(<EmptyState title="Nothing due" description="You're all caught up." />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  it('renders the page title as the h1, with its actions beside it', () => {
    render(<PageHeader title="Courses" actions={<button>New</button>} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })
})
