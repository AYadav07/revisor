import { Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HERO_PRIMARY_BUTTON, HeroHeader } from '@/components/HeroHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/useAuth'
import { pluralize } from '@/lib/plural'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { reviewPath } from '@/routes'
import { CourseProgressList } from './CourseProgressList'
import { DueList } from './DueList'
import { ReviewForecast } from './ReviewForecast'
import { StatTiles } from './StatTiles'
import { useDueList, useSummary } from './useDashboard'

function greeting(now: Date): string {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

/** Home screen: how much is due, what it is, what's coming, and how far along each course is (UI_DESIGN.md §4). */
export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const summary = useSummary().data
  // The first page of today's list is the start of the review queue. It is the same request the
  // "Today" list makes, so the two share one cache entry rather than fetching twice.
  const firstDue = useDueList('today', 0).data?.content[0]

  const firstName = user?.name.trim().split(/\s+/)[0]
  const dueNow = summary && summary.dueToday + summary.overdue
  const status =
    dueNow === undefined ? '' : dueNow === 0 ? " You're all caught up." : ` ${pluralize(dueNow, 'review')} to do today.`

  return (
    <>
      <HeroHeader
        title="Dashboard"
        description={`${greeting(new Date())}${firstName ? `, ${firstName}` : ''}.${status}`}
        actions={
          firstDue && (
            <Button asChild size="lg" className={HERO_PRIMARY_BUTTON}>
              <Link to={reviewPath(firstDue.subtopicId)}>
                <Play aria-hidden />
                Start review
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-6">
        <StatTiles />
        {/* grid-cols-1, not an implicit column: that one would size to its widest row and overflow a phone. */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DueList />
          </div>
          <div className="space-y-6">
            <ReviewForecast />
            <CourseProgressList />
          </div>
        </div>
      </div>
    </>
  )
}
