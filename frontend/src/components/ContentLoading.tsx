import { Skeleton } from '@/components/ui/skeleton'

interface ContentLoadingProps {
  /** What's loading, for screen readers, e.g. "Loading course". */
  label?: string
}

/** Placeholder for the page area while a route's code or data loads; the shell around it stays put. */
export function ContentLoading({ label = 'Loading page' }: ContentLoadingProps) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
