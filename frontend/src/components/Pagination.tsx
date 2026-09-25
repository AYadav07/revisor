import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  /** Zero-based, as in the API. */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Previous/Next for the API's paginated lists. Renders nothing when everything fits on one page. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-4">
      <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground" aria-current="page">
        Page {page + 1} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}
