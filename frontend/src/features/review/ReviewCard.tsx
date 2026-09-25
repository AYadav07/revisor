import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, type DueItem, type Quality } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalDate } from '@/lib/date'
import { GRADES } from './grades'
import { useSubmitReview, useSubtopicNotes } from './useReview'

interface ReviewCardProps {
  item: DueItem
  /** 1-based place in the session, for "3 of 12". */
  position: number
  total: number
  /** Called once the review has been saved. */
  onGraded: () => void
  /** Called to move on from a subtopic that can't be graded (deleted, or never learned). */
  onSkip: () => void
}

type Problem = 'failed' | 'unreviewable'

/**
 * One subtopic in a session: its title, then — after the user has tried to recall it and clicked
 * Reveal — its notes and the six grade buttons. Mounted per subtopic (keyed by the parent), so the
 * revealed state starts closed for each one.
 */
export function ReviewCard({ item, position, total, onGraded, onSkip }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const notes = useSubtopicNotes(item.subtopicId)
  const submit = useSubmitReview()

  function grade(quality: Quality) {
    setProblem(null)
    submit.mutate(
      { subtopicId: item.subtopicId, quality },
      {
        onSuccess: (result) => {
          toast.success(`Next review ${formatLocalDate(result.nextReviewDate)}`)
          onGraded()
        },
        // 404: deleted meanwhile. 409: no longer learned. Neither can succeed on retry.
        onError: (error) =>
          setProblem(error instanceof ApiError && (error.status === 404 || error.status === 409) ? 'unreviewable' : 'failed'),
      },
    )
  }

  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        Reviewing {position} of {total}
      </p>
      <PageHeader title={item.subtopicTitle} description={`${item.courseTitle} › ${item.topicTitle}`} />

      <Card>
        <CardContent className="space-y-4">
          {!revealed ? (
            <>
              <p className="text-muted-foreground">Try to recall it, then reveal your notes.</p>
              <Button onClick={() => setRevealed(true)}>Reveal</Button>
            </>
          ) : (
            <>
              <Notes query={notes} />

              {problem === 'unreviewable' ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between gap-4">
                    This subtopic can't be reviewed any more. It may have been deleted.
                    <Button variant="outline" size="sm" onClick={onSkip}>
                      Continue
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {problem === 'failed' && (
                    <Alert variant="destructive">
                      <AlertDescription>Couldn't save your grade. Please try again.</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <p className="mb-2 text-sm font-medium">How well did you remember it?</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {GRADES.map((grade_) => (
                        <Button
                          key={grade_.quality}
                          variant="outline"
                          className="h-auto flex-col items-start gap-0 py-2 text-left whitespace-normal"
                          disabled={submit.isPending}
                          onClick={() => grade(grade_.quality)}
                        >
                          <span>
                            {grade_.quality} · {grade_.label}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">{grade_.hint}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Notes({ query }: { query: ReturnType<typeof useSubtopicNotes> }) {
  if (query.isPending) return <Skeleton role="status" aria-label="Loading notes" className="h-16 w-full" />
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          Couldn't load your notes.
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  return query.data.notes ? (
    <p className="whitespace-pre-wrap">{query.data.notes}</p>
  ) : (
    <p className="text-muted-foreground">You didn't write any notes for this one.</p>
  )
}
