import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { pageFromSearch } from '@/lib/pageParam'
import { CourseCard } from './CourseCard'
import { CreateCourseDialog } from './CreateCourseDialog'
import { COURSES_PAGE_SIZE, useCourses } from './useCourses'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('page'))
  const [creating, setCreating] = useState(false)
  const { data, isPending, isError, refetch, isFetching } = useCourses(page)

  function goToPage(next: number) {
    setSearchParams(next === 0 ? {} : { page: String(next + 1) })
  }

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      New course
    </Button>
  )

  return (
    <>
      <PageHeader title="Courses" actions={data && data.totalElements > 0 ? createButton : undefined} />

      {isPending && (
        <div role="status" aria-label="Loading courses" className={GRID}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            Couldn't load your courses.
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data && data.totalElements === 0 && (
        <EmptyState
          title="No courses yet"
          description="Create your first course, then add the topics you want to revise."
          action={createButton}
        />
      )}

      {/* Past the last page (a stale link, or the page emptied after deletions): don't leave a blank screen. */}
      {data && data.totalElements > 0 && data.content.length === 0 && (
        <EmptyState
          title="No courses on this page"
          description="This page is past the end of your list."
          action={<Button onClick={() => goToPage(0)}>Go to the first page</Button>}
        />
      )}

      {data && data.content.length > 0 && (
        <>
          <ul className={GRID}>
            {data.content.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(data.totalElements / COURSES_PAGE_SIZE)} onPageChange={goToPage} />
        </>
      )}

      <CreateCourseDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
