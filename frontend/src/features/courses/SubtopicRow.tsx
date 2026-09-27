import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SubtopicTreeNode } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatLocalDate, todayLocalIso } from '@/lib/date'
import { reviewPath } from '@/routes'
import { cn } from 'cn'
import { subtopicState, type SubtopicState } from './courseTree'

interface SubtopicRowProps {
  subtopic: SubtopicTreeNode
  onLearn: (subtopicId: number) => void
  onEdit: (subtopic: SubtopicTreeNode) => void
  onDelete: (subtopic: SubtopicTreeNode) => void
  /** True while this subtopic's "mark as learned" request is in flight. */
  learning: boolean
}

/** The marker at the start of each row: state at a glance, in the app's state colors (UI_DESIGN.md §2). */
const MARKER: Record<SubtopicState, string> = {
  new: 'border-2 border-muted-foreground/40',
  scheduled: 'bg-success',
  due: 'bg-warning',
  overdue: 'bg-destructive',
}

/** One subtopic in a topic: its title and notes, and either its review state or the way to start it. */
export function SubtopicRow({ subtopic, onLearn, onEdit, onDelete, learning }: SubtopicRowProps) {
  // The browser's "today" can differ from the server's for someone whose device timezone isn't their
  // profile's; the review screen sorts that out, so a link that is a day early or late just opens a
  // session on whatever is really due.
  const state = subtopicState(subtopic, todayLocalIso())

  return (
    <li className="flex items-start gap-3 py-3">
      <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', MARKER[state])} />
      {/* Text and actions sit side by side where there's room; on a phone the actions wrap below. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="font-medium">{subtopic.title}</p>
          {subtopic.notes && <p className="line-clamp-2 max-w-prose text-sm text-muted-foreground">{subtopic.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {state === 'new' && (
            <Button
              size="sm"
              variant="outline"
              disabled={learning}
              aria-label={`Mark “${subtopic.title}” as learned`}
              onClick={() => onLearn(subtopic.id)}
            >
              {learning ? 'Saving…' : 'Mark as learned'}
            </Button>
          )}
          {state === 'scheduled' && subtopic.nextReviewDate && (
            <div className="flex flex-col gap-0.5 sm:items-end">
              <Badge variant="success">Learned</Badge>
              <span className="text-xs text-muted-foreground">Next review {formatLocalDate(subtopic.nextReviewDate)}</span>
            </div>
          )}
          {(state === 'due' || state === 'overdue') && (
            <>
              <Badge variant={state === 'due' ? 'warning' : 'destructive'}>{state === 'due' ? 'Due today' : 'Overdue'}</Badge>
              <Button asChild size="sm">
                <Link to={reviewPath(subtopic.id)} aria-label={`Review “${subtopic.title}”`}>
                  Review
                </Link>
              </Button>
            </>
          )}
          <div className="flex">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit “${subtopic.title}”`} onClick={() => onEdit(subtopic)}>
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete “${subtopic.title}”`}
              onClick={() => onDelete(subtopic)}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
