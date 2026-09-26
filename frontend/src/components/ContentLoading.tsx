import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder for the page area while a route's code loads; the shell around it stays put. */
export function ContentLoading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
