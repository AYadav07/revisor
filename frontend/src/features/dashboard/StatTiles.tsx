import { LoadError } from '@/components/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from './StatTile'
import { useSummary } from './useDashboard'

const GRID = 'grid gap-4 sm:grid-cols-3'

/** Due today, overdue, and everything learned so far. */
export function StatTiles() {
  const summary = useSummary()

  if (summary.isPending) {
    return (
      <div role="status" aria-label="Loading summary" className={GRID}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (summary.isError) {
    return <LoadError message="Couldn't load your summary." onRetry={() => summary.refetch()} retrying={summary.isFetching} />
  }

  return (
    <div className={GRID}>
      <StatTile label="Due today" value={summary.data.dueToday} />
      <StatTile label="Overdue" value={summary.data.overdue} alert={summary.data.overdue > 0} />
      <StatTile label="Learned" value={summary.data.totalLearned} />
    </div>
  )
}
