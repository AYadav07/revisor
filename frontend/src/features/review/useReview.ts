import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courseApi, dashboardApi, reviewApi, type Quality } from '@/api'
import { courseKeys } from '@/features/courses/queryKeys'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { reviewKeys } from './queryKeys'

/** The most subtopics one session covers; the backend's own page-size cap. */
export const REVIEW_QUEUE_SIZE = 100

/**
 * Everything due today or overdue, oldest first: the queue for one review session (UI_DESIGN.md §4).
 *
 * The queue is a snapshot taken when the session starts, and must stay put while it runs: reviewing
 * an item makes it no longer due, and a refetch would pull it out from under the position the
 * session is tracking. So it never refetches by itself, and is dropped from the cache the moment
 * the session screen closes, so the next session starts from a fresh list.
 */
export function useReviewQueue() {
  return useQuery({
    queryKey: reviewKeys.queue(),
    queryFn: () => dashboardApi.due({ range: 'today', page: 0, size: REVIEW_QUEUE_SIZE }),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** A subtopic's notes (the "answer" revealed during review); the due list doesn't carry them. */
export function useSubtopicNotes(subtopicId: number) {
  return useQuery({
    queryKey: courseKeys.subtopic(subtopicId),
    queryFn: () => courseApi.getSubtopic(subtopicId),
  })
}

/**
 * Grades a review. The queue is deliberately left alone (see {@link useReviewQueue}); what does
 * change is the subtopic's next review date, shown on course pages, and every dashboard number.
 */
export function useSubmitReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subtopicId, quality }: { subtopicId: number; quality: Quality }) =>
      reviewApi.review(subtopicId, quality),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.details() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}
