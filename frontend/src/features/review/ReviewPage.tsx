import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ContentLoading } from '@/components/ContentLoading'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { parseIdParam } from '@/lib/ids'
import { pluralize } from '@/lib/plural'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ROUTES, reviewPath } from '@/routes'
import { ReviewCard } from './ReviewCard'
import { useReviewQueue } from './useReview'

/**
 * `/subtopics/:id/review`: a session over everything currently due, with the URL naming the subtopic
 * being shown (UI_DESIGN.md §4). Grading one moves to the next, and when none are left the session
 * is complete.
 */
export function ReviewPage() {
  const subtopicId = parseIdParam(useParams().id)
  const navigate = useNavigate()
  const queue = useReviewQueue()
  const [reviewed, setReviewed] = useState(0)
  const [finished, setFinished] = useState(false)
  useDocumentTitle('Review')

  if (queue.isPending) {
    return <ContentLoading label="Loading review" />
  }

  if (queue.isError) {
    return <LoadError message="Couldn't load your reviews." onRetry={() => queue.refetch()} retrying={queue.isFetching} />
  }

  const items = queue.data.content
  const backToDashboard = (
    <Button asChild>
      <Link to={ROUTES.dashboard}>Back to dashboard</Link>
    </Button>
  )

  if (finished) {
    return (
      <EmptyState
        title="Session complete"
        description={`You reviewed ${pluralize(reviewed, 'subtopic')}. Nice work.`}
        action={backToDashboard}
      />
    )
  }

  const index = items.findIndex((item) => item.subtopicId === subtopicId)
  if (index === -1) {
    // Not in today's queue (not due, not learned, not yours, or not a real id): the session is
    // still the right place to be, so start it from the top rather than show an error.
    return items.length === 0 ? (
      <EmptyState title="Nothing due" description="You're all caught up. Come back when more reviews are due." action={backToDashboard} />
    ) : (
      <Navigate to={reviewPath(items[0].subtopicId)} replace />
    )
  }

  function advance(reviewedOne: boolean) {
    if (reviewedOne) setReviewed((count) => count + 1)
    const next = items[index + 1]
    if (next) navigate(reviewPath(next.subtopicId), { replace: true })
    else setFinished(true)
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to={ROUTES.dashboard}>Exit review</Link>
      </Button>
      <ReviewCard
        key={items[index].subtopicId}
        item={items[index]}
        position={index + 1}
        total={items.length}
        onGraded={() => advance(true)}
        onSkip={() => advance(false)}
      />
    </>
  )
}
