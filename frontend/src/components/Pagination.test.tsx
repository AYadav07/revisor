import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders nothing when everything fits on one page', () => {
    for (const totalPages of [0, 1]) {
      const { container } = render(<Pagination page={0} totalPages={totalPages} onPageChange={vi.fn()} />)
      expect(container).toBeEmptyDOMElement()
    }
  })

  it('shows a one-based position while taking zero-based pages', () => {
    render(<Pagination page={1} totalPages={4} onPageChange={vi.fn()} />)

    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument()
  })

  it('cannot go before the first page', () => {
    render(<Pagination page={0} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('cannot go past the last page', () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled()
  })

  it('reports the neighbouring page when Previous or Next is clicked', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /previous/i }))

    expect(onPageChange).toHaveBeenNthCalledWith(1, 2)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 0)
  })
})
