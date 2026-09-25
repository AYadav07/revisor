import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DueItem, DueRange } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalDate, todayLocalIso } from '@/lib/date'
import { pluralize } from '@/lib/plural'
import { courseDetailPath, reviewPath } from '@/routes'
import { groupByCourse } from './dashboardStats'
import { DUE_PAGE_SIZE, useDueList } from './useDashboard'

const RANGES: { value: DueRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
]

/** What's due, grouped by course, for today or the coming week (overdue items are in both). */
export function DueList() {
  const [range, setRange] = useState<DueRange>('today')
  const [page, setPage] = useState(0)
  const due = useDueList(range, page)

  function chooseRange(next: DueRange) {
    setRange(next)
    setPage(0)
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Due for review</CardTitle>
        <div role="group" aria-label="Due range" className="flex gap-1">
          {RANGES.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={range === value ? 'default' : 'outline'}
              aria-pressed={range === value}
              onClick={() => chooseRange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {due.isPending && (
          <div role="status" aria-label="Loading due list" className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}

        {due.isError && (
          <LoadError message="Couldn't load your reviews." onRetry={() => due.refetch()} retrying={due.isFetching} />
        )}

        {due.data && due.data.totalElements === 0 && (
          <EmptyState
            title="Nothing due"
            description={range === 'today' ? "You're all caught up for today." : "Nothing is due in the next seven days."}
          />
        )}

        {/* Past the last page (the list shrank as items were reviewed): don't leave a blank card. */}
        {due.data && due.data.totalElements > 0 && due.data.content.length === 0 && (
          <EmptyState
            title="No reviews on this page"
            description="This page is past the end of your list."
            action={<Button onClick={() => setPage(0)}>Go to the first page</Button>}
          />
        )}

        {due.data && due.data.content.length > 0 && (
          <>
            <div className="space-y-6">
              {groupByCourse(due.data.content).map((group) => (
                <section key={group.courseId} aria-label={group.courseTitle}>
                  <h3 className="mb-1 text-sm font-semibold">
                    <Link to={courseDetailPath(group.courseId)} className="hover:underline">
                      {group.courseTitle}
                    </Link>
                  </h3>
                  <ul className="divide-y">
                    {group.items.map((item) => (
                      <DueRow key={item.subtopicId} item={item} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <Pagination page={page} totalPages={Math.ceil(due.data.totalElements / DUE_PAGE_SIZE)} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DueRow({ item }: { item: DueItem }) {
  // Only what's due now can be reviewed; later this week is shown for planning, not linked. "Now" is
  // judged on the browser's date (the API's daysOverdue is 0 for both today and later).
  const dueNow = item.daysOverdue > 0 || item.nextReviewDate <= todayLocalIso()
  const title = dueNow ? (
    <Link to={reviewPath(item.subtopicId)} className="font-medium hover:underline">
      {item.subtopicTitle}
    </Link>
  ) : (
    <span className="font-medium">{item.subtopicTitle}</span>
  )

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{item.topicTitle}</p>
      </div>
      {item.daysOverdue > 0 ? (
        <Badge variant="destructive">{pluralize(item.daysOverdue, 'day')} overdue</Badge>
      ) : dueNow ? (
        <Badge variant="warning">Due today</Badge>
      ) : (
        <Badge variant="outline">Due {formatLocalDate(item.nextReviewDate)}</Badge>
      )}
    </li>
  )
}
