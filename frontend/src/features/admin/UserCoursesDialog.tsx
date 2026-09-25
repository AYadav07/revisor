import { useState } from 'react'
import type { AdminUser } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { Pagination } from '@/components/Pagination'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { percentLearned } from '@/features/dashboard/dashboardStats'
import { ADMIN_PAGE_SIZE, useUserCourses } from './useAdmin'

interface UserCoursesDialogProps {
  /** Whose courses to show; the dialog is open exactly when this is set. */
  user: AdminUser | null
  onClose: () => void
}

/** Another user's courses, read-only — the admin's one deliberate window into private data (ARCHITECTURE.md §7). */
export function UserCoursesDialog({ user, onClose }: UserCoursesDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{user && <UserCourses user={user} />}</DialogContent>
    </Dialog>
  )
}

// Mounted only while open, so each opening starts on the first page.
function UserCourses({ user }: { user: AdminUser }) {
  const [page, setPage] = useState(0)
  const courses = useUserCourses(user.id, page)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{user.name}'s courses</DialogTitle>
        <DialogDescription>A read-only view. Viewing it is recorded in the admin log.</DialogDescription>
      </DialogHeader>

      {courses.isPending && (
        <div role="status" aria-label="Loading courses" className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}

      {courses.isError && (
        <LoadError message="Couldn't load their courses." onRetry={() => courses.refetch()} retrying={courses.isFetching} />
      )}

      {courses.data && courses.data.totalElements === 0 && (
        <EmptyState title="No courses" description="This user hasn't created any courses." />
      )}

      {courses.data && courses.data.content.length > 0 && (
        <>
          <ul className="space-y-4">
            {courses.data.content.map((course) => (
              <li key={course.courseId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{course.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {course.learnedCount} of {course.totalCount} learned
                  </span>
                </div>
                {course.description && <p className="mb-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                <Progress value={percentLearned(course.learnedCount, course.totalCount)} aria-label={`${course.title} progress`} />
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(courses.data.totalElements / ADMIN_PAGE_SIZE)} onPageChange={setPage} />
        </>
      )}
    </>
  )
}
