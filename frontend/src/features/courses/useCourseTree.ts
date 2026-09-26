import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, courseApi, reviewApi, type SubtopicRequest, type TopicRequest } from '@/api'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { courseKeys } from './queryKeys'

/**
 * One course with its whole topic/subtopic tree, including each subtopic's learned state and next
 * review date (a single request — API.md). Pass null for an id that can't be a real course, and
 * nothing is fetched.
 */
export function useCourseTree(courseId: number | null) {
  return useQuery({
    queryKey: courseKeys.detail(courseId ?? 0),
    queryFn: () => courseApi.getCourse(courseId!),
    enabled: courseId !== null,
    // A 404 (missing, or someone else's) is a final answer, not a glitch worth another attempt —
    // and the default retry policy already skips every 4xx, so this stays a fast "not found".
  })
}

/** True when the failure means "no such course, or not yours" (the API answers 404 for both). */
export function isCourseNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/**
 * Every change to a course's tree is followed by refetching that tree, the single source of truth —
 * and marks the dashboard stale, since its due list and progress figures are built from the same data.
 */
function useRefreshTree(courseId: number) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ])
}

export function useCreateTopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: (request: TopicRequest) => courseApi.createTopic(courseId, request),
    onSuccess: refresh,
  })
}

export function useCreateSubtopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: ({ topicId, request }: { topicId: number; request: SubtopicRequest }) =>
      courseApi.createSubtopic(topicId, request),
    onSuccess: refresh,
  })
}

/** Marks a subtopic learned (idempotent server-side, so a stray double-click is harmless). */
export function useLearnSubtopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: (subtopicId: number) => reviewApi.learn(subtopicId),
    onSuccess: refresh,
  })
}

export function useUpdateTopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: ({ topicId, request }: { topicId: number; request: TopicRequest }) =>
      courseApi.updateTopic(topicId, request),
    onSuccess: refresh,
  })
}

// Deletes refresh the tree whether or not they succeeded: a 404 means it is already gone, and the
// tree should stop showing it either way.
export function useDeleteTopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: (topicId: number) => courseApi.deleteTopic(topicId),
    onSettled: refresh,
  })
}

export function useUpdateSubtopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subtopicId, request }: { subtopicId: number; request: SubtopicRequest }) =>
      courseApi.updateSubtopic(subtopicId, request),
    // The review screen caches a subtopic's notes; an edit must not leave the old ones there.
    onSuccess: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: courseKeys.subtopics() })]),
  })
}

export function useDeleteSubtopic(courseId: number) {
  const refresh = useRefreshTree(courseId)
  return useMutation({
    mutationFn: (subtopicId: number) => courseApi.deleteSubtopic(subtopicId),
    onSettled: refresh,
  })
}
