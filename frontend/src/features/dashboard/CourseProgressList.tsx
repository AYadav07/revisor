import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { courseDetailPath, ROUTES } from '@/routes'
import { percentLearned } from './dashboardStats'
import { useProgress } from './useDashboard'

/** Learned / total subtopics for each course, as a bar. */
export function CourseProgressList() {
  const progress = useProgress()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {progress.isPending && (
          <div role="status" aria-label="Loading progress" className="space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}

        {progress.isError && (
          <LoadError message="Couldn't load your progress." onRetry={() => progress.refetch()} retrying={progress.isFetching} />
        )}

        {progress.data && progress.data.length === 0 && (
          <EmptyState
            title="No courses yet"
            description="Create a course to start tracking your progress."
            action={
              <Button asChild>
                <Link to={ROUTES.courses}>Go to courses</Link>
              </Button>
            }
          />
        )}

        {progress.data && progress.data.length > 0 && (
          <ul className="space-y-4">
            {progress.data.map((course) => (
              <li key={course.courseId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <Link to={courseDetailPath(course.courseId)} className="truncate font-medium hover:underline">
                    {course.courseTitle}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {course.learnedCount} of {course.totalCount} learned
                  </span>
                </div>
                <Progress
                  value={percentLearned(course.learnedCount, course.totalCount)}
                  aria-label={`${course.courseTitle} progress`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
