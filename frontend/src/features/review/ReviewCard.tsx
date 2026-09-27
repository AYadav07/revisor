import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, type DueItem, type Quality } from '@/api'
import { LoadError } from '@/components/LoadError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalDate } from '@/lib/date'
import { cn } from 'cn'
import { GRADES, gradeTone } from './grades'
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

/** The stripe on each grade button: where the grade falls on SM-2's fail/pass line (see grades.ts). */
const TONE_BORDER = {
  fail: 'border-l-destructive',
  hard: 'border-l-warning',
  pass: 'border-l-success',
} as const

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

  // Keyboard: Space reveals, 0-5 grades — the usual flashcard controls. Ignored while typing
  // anywhere, with a modifier held, or while a grade is being saved.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (!revealed && event.key === ' ') {
        event.preventDefault()
        setRevealed(true)
      } else if (revealed && !submit.isPending && problem !== 'unreviewable' && /^[0-5]$/.test(event.key)) {
        grade(Number(event.key) as Quality)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

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
      <div className="mb-4 flex items-center gap-3">
        <p className="shrink-0 text-sm text-muted-foreground">
          Reviewing {position} of {total}
        </p>
        {/* Counts the card in front of the user, so "1 of 5" already shows a sliver. The track uses
            the border tone: the muted one would vanish against the page canvas. */}
        <Progress value={(position / total) * 100} aria-label="Session progress" className="h-1.5 bg-border" />
      </div>

      {/* The flashcard: where it's from, the prompt, and — once revealed — the answer below a rule. */}
      <Card className="gap-0 py-0 shadow-md">
        <div className="px-6 pt-10 pb-8 text-center sm:px-10">
          <p className="text-sm text-muted-foreground">
            {item.courseTitle} › {item.topicTitle}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{item.subtopicTitle}</h1>
        </div>
        <CardContent className={cn('space-y-4 px-6 pb-8 sm:px-10', revealed && 'border-t pt-6')}>
          {!revealed ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground">Try to recall it, then reveal your notes.</p>
              <div className="flex items-center gap-3">
                <Button size="lg" onClick={() => setRevealed(true)}>
                  Reveal
                </Button>
                <span className="text-xs text-muted-foreground">
                  or press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans">Space</kbd>
                </span>
              </div>
            </div>
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
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">How well did you remember it?</p>
                      <span className="text-xs text-muted-foreground">
                        Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans">0</kbd>–
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans">5</kbd>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {GRADES.map((grade_) => (
                        <Button
                          key={grade_.quality}
                          variant="outline"
                          className={cn(
                            'h-auto flex-col items-start gap-0 border-l-4 py-2.5 text-left whitespace-normal',
                            TONE_BORDER[gradeTone(grade_.quality)],
                          )}
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
    return <LoadError message="Couldn't load your notes." onRetry={() => query.refetch()} retrying={query.isFetching} />
  }
  return query.data.notes ? (
    <p className="whitespace-pre-wrap">{query.data.notes}</p>
  ) : (
    <p className="text-muted-foreground">You didn't write any notes for this one.</p>
  )
}
