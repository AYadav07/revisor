import { AlarmClock, CalendarCheck, CircleCheckBig } from 'lucide-react'
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
        <Skeleton className="h-22 rounded-xl" />
        <Skeleton className="h-22 rounded-xl" />
        <Skeleton className="h-22 rounded-xl" />
      </div>
    )
  }

  if (summary.isError) {
    return <LoadError message="Couldn't load your summary." onRetry={() => summary.refetch()} retrying={summary.isFetching} />
  }

  return (
    <div className={GRID}>
      <StatTile label="Due today" value={summary.data.dueToday} icon={CalendarCheck} tone="warning" />
      <StatTile
        label="Overdue"
        value={summary.data.overdue}
        icon={AlarmClock}
        // Only alarming when there is something overdue; zero is good news, not a warning.
        tone={summary.data.overdue > 0 ? 'destructive' : 'neutral'}
        alert={summary.data.overdue > 0}
      />
      <StatTile label="Learned" value={summary.data.totalLearned} icon={CircleCheckBig} tone="success" />
    </div>
  )
}
