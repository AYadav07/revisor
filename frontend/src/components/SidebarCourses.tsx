import { NavLink } from 'react-router-dom'
import { CourseAvatar } from '@/components/CourseAvatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { percentLearned } from '@/features/dashboard/dashboardStats'
import { useProgress } from '@/features/dashboard/useDashboard'
import { courseDetailPath } from '@/routes'

/**
 * Every course in the sidebar with how much of it is learned, for jumping straight to one. Shares
 * the dashboard's progress query, so it costs no extra request and updates when a subtopic is learned.
 */
export function SidebarCourses({ onNavigate }: { onNavigate?: () => void }) {
  const progress = useProgress()

  return (
    <section aria-labelledby="sidebar-courses" className="space-y-1">
      <h2 id="sidebar-courses" className="px-3 pb-1 text-xs font-medium text-sidebar-muted-foreground">
        Your courses
      </h2>

      {progress.isPending && (
        <div role="status" aria-label="Loading courses" className="space-y-2 px-3">
          <Skeleton className="h-8 bg-sidebar-accent" />
          <Skeleton className="h-8 bg-sidebar-accent" />
        </div>
      )}

      {/* The dashboard and the courses page report load errors; the sidebar just stays quiet. */}
      {progress.data?.length === 0 && <p className="px-3 text-sm text-sidebar-muted-foreground">No courses yet.</p>}

      {progress.data && progress.data.length > 0 && (
        <ul className="space-y-0.5">
          {progress.data.map((course) => (
            <li key={course.courseId}>
              <NavLink
                to={courseDetailPath(course.courseId)}
                onClick={onNavigate}
                className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-white"
              >
                <span className="flex items-center gap-2.5">
                  <CourseAvatar title={course.courseTitle} size="sm" className="bg-white/10 text-white" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{course.courseTitle}</span>
                      <span className="shrink-0 text-xs text-sidebar-muted-foreground tabular-nums">
                        {course.learnedCount}/{course.totalCount}
                      </span>
                    </span>
                    {/* Decorative: the count beside it carries the same information for screen readers. */}
                    <Progress
                      aria-hidden
                      value={percentLearned(course.learnedCount, course.totalCount)}
                      className="mt-1.5 h-1 bg-white/10"
                    />
                  </span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
