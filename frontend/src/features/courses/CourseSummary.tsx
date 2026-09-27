import type { CourseTree } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { percentLearned } from '@/features/dashboard/dashboardStats'
import { todayLocalIso } from '@/lib/date'
import { cn } from 'cn'
import { courseProgress, stateCounts, type SubtopicState } from './courseTree'

/** Same order and colors as the markers on each subtopic row, so this doubles as their legend. */
const STATES: { state: SubtopicState; label: string; marker: string }[] = [
  { state: 'overdue', label: 'Overdue', marker: 'bg-destructive' },
  { state: 'due', label: 'Due today', marker: 'bg-warning' },
  { state: 'scheduled', label: 'Scheduled', marker: 'bg-success' },
  { state: 'new', label: 'Not started', marker: 'border-2 border-muted-foreground/40' },
]

/** The course page's side panel: overall progress, and how many subtopics are in each state. */
export function CourseSummary({ tree }: { tree: CourseTree }) {
  const { learned, total } = courseProgress(tree)
  const counts = stateCounts(tree, todayLocalIso())
  const percent = percentLearned(learned, total)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight">{percent}%</p>
          <p className="text-sm text-muted-foreground">
            {learned} of {total} subtopics learned
          </p>
        </div>
        <Progress value={percent} aria-label="Course progress" />
        <ul className="space-y-2 text-sm">
          {STATES.map(({ state, label, marker }) => (
            <li key={state} className="flex items-center gap-2">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', marker)} />
              <span className="flex-1">{label}</span>
              <span className="font-medium tabular-nums">{counts[state]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
