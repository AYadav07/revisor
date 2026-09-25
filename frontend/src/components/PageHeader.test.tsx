import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Courses" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
  })

  it('shows the description when there is one', () => {
    render(<PageHeader title="Courses" description="Everything you are learning" />)

    expect(screen.getByText('Everything you are learning')).toBeInTheDocument()
  })

  it.each([null, undefined, ''])('shows no description line for %j', (description) => {
    const { container } = render(<PageHeader title="Courses" description={description} />)

    expect(container.querySelector('p')).toBeNull()
  })

  it('renders the actions', () => {
    render(<PageHeader title="Courses" actions={<button>New course</button>} />)

    expect(screen.getByRole('button', { name: 'New course' })).toBeInTheDocument()
  })
})
