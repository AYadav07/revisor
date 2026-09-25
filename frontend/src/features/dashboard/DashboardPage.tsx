import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { reviewPath } from '@/routes'
import { CourseProgressList } from './CourseProgressList'
import { DueList } from './DueList'
import { StatTiles } from './StatTiles'
import { useDueList } from './useDashboard'

/** Home screen: how much is due, what it is, and how far along each course is (UI_DESIGN.md §4). */
export function DashboardPage() {
  // The first page of today's list is the start of the review queue. It is the same request the
  // "Today" list makes, so the two share one cache entry rather than fetching twice.
  const firstDue = useDueList('today', 0).data?.content[0]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What to revise, and how you're getting on."
        actions={
          firstDue && (
            <Button asChild>
              <Link to={reviewPath(firstDue.subtopicId)}>Start review</Link>
            </Button>
          )
        }
      />
      <div className="space-y-6">
        <StatTiles />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DueList />
          </div>
          <CourseProgressList />
        </div>
      </div>
    </>
  )
}
