import { Skeleton } from '@/components/ui/skeleton'

/** Full-page placeholder for the moments before we know what to render (e.g. session restore). */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  )
}
