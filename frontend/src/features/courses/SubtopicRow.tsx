import { Pencil, Trash2 } from 'lucide-react'
import type { SubtopicTreeNode } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatLocalDate } from '@/lib/date'

interface SubtopicRowProps {
  subtopic: SubtopicTreeNode
  onLearn: (subtopicId: number) => void
  onEdit: (subtopic: SubtopicTreeNode) => void
  onDelete: (subtopic: SubtopicTreeNode) => void
  /** True while this subtopic's "mark as learned" request is in flight. */
  learning: boolean
}

/** One subtopic in a topic: its title and notes, and either its review state or the way to start it. */
export function SubtopicRow({ subtopic, onLearn, onEdit, onDelete, learning }: SubtopicRowProps) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-medium">{subtopic.title}</p>
        {subtopic.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{subtopic.notes}</p>}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {subtopic.learned ? (
          <div className="flex flex-col items-end gap-1">
            <Badge variant="success">Learned</Badge>
            {subtopic.nextReviewDate && (
              <span className="text-xs text-muted-foreground">
                Next review {formatLocalDate(subtopic.nextReviewDate)}
              </span>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            disabled={learning}
            aria-label={`Mark “${subtopic.title}” as learned`}
            onClick={() => onLearn(subtopic.id)}
          >
            {learning ? 'Saving…' : 'Mark as learned'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit “${subtopic.title}”`}
          onClick={() => onEdit(subtopic)}
        >
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
    </li>
  )
}
