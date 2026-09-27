import { Link } from 'react-router-dom'
import type { CourseProgress, CourseResponse } from '@/api'
import { CourseAvatar } from '@/components/CourseAvatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { percentLearned } from '@/features/dashboard/dashboardStats'
import { courseDetailPath } from '@/routes'

interface CourseCardProps {
  course: CourseResponse
  /** How much of the course is learned; omitted while it loads (or if it couldn't be loaded). */
  progress?: CourseProgress
}

/** One course in the list. The whole card is the link to its topic tree. */
export function CourseCard({ course, progress }: CourseCardProps) {
  return (
    <Link
      to={courseDetailPath(course.id)}
      className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-4 overflow-hidden pt-0 transition-[border-color,box-shadow,translate] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        {/* Cover strip in the brand gradient; the badge sits on its lower edge. */}
        <div aria-hidden className="relative h-16 bg-linear-to-br from-hero-from to-hero-to">
          <span className="absolute -top-8 -right-6 size-24 rounded-full bg-white/10" />
        </div>
        <CardHeader>
          <CourseAvatar title={course.title} className="relative z-10 -mt-9 mb-1 bg-card text-primary shadow-md ring-4 ring-card" />
          <CardTitle className="truncate text-base">{course.title}</CardTitle>
          {course.description && <CardDescription className="line-clamp-2">{course.description}</CardDescription>}
        </CardHeader>
        {progress && (
          <CardContent className="mt-auto">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{progress.totalCount === 0 ? 'No subtopics yet' : `${progress.learnedCount} of ${progress.totalCount} learned`}</span>
              <span>{percentLearned(progress.learnedCount, progress.totalCount)}%</span>
            </div>
            <Progress
              value={percentLearned(progress.learnedCount, progress.totalCount)}
              aria-label={`${course.title} progress`}
              className="h-1.5"
            />
          </CardContent>
        )}
      </Card>
    </Link>
  )
}
