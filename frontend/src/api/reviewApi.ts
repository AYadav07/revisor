import { apiFetch } from './client'
import type { LearnResponse, Quality, ReviewResponse } from './types'

export const reviewApi = {
  /**
   * Marks a subtopic learned and schedules its first review. Idempotent: repeating it on an
   * already-learned subtopic returns the original record unchanged, so double-clicks are safe.
   */
  learn: (subtopicId: number) =>
    apiFetch<LearnResponse>(`/subtopics/${subtopicId}/learn`, { method: 'POST' }),

  /** 409 if the subtopic hasn't been learned yet. */
  review: (subtopicId: number, quality: Quality) =>
    apiFetch<ReviewResponse>(`/subtopics/${subtopicId}/review`, {
      method: 'POST',
      body: { quality },
    }),
}
