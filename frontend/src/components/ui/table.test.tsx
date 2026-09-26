import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

describe('Table', () => {
  it('renders an accessible table, scrollable sideways inside its own container', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ann</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    const table = screen.getByRole('table')
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ann' })).toBeInTheDocument()
    expect(table.parentElement).toHaveClass('overflow-x-auto')
  })
})
