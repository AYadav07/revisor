import { Link } from 'react-router-dom'
import type { CourseResponse } from '@/api'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { courseDetailPath } from '@/routes'

/** One course in the list. The whole card is the link to its topic tree. */
export function CourseCard({ course }: { course: CourseResponse }) {
  return (
    <Link
      to={courseDetailPath(course.id)}
      className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader>
          <CardTitle className="truncate">{course.title}</CardTitle>
          {course.description && <CardDescription className="line-clamp-2">{course.description}</CardDescription>}
        </CardHeader>
      </Card>
    </Link>
  )
}
