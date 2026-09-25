import { z } from 'zod'
import type { CourseRequest, SubtopicRequest } from '@/api'

/**
 * Mirrors the backend's request validation (CourseRequest, TopicRequest, SubtopicRequest) — the
 * server stays the authority; this gives instant feedback (UI_DESIGN.md §6). The limits are the
 * backend's, not the illustrative ones in UI_DESIGN.md's example.
 */
const title = z.string().trim().min(1, 'Title is required').max(255, 'Title must be at most 255 characters')

export const courseSchema = z.object({
  title,
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters'),
})

export const topicSchema = z.object({ title })

export const subtopicSchema = z.object({
  title,
  notes: z.string().trim().max(10000, 'Notes must be at most 10000 characters'),
})

export type CourseValues = z.infer<typeof courseSchema>
export type TopicValues = z.infer<typeof topicSchema>
export type SubtopicValues = z.infer<typeof subtopicSchema>

/** A blank description is sent as null rather than an empty string, so "no description" is one thing. */
export function toCourseRequest(values: CourseValues): CourseRequest {
  return { title: values.title, description: values.description === '' ? null : values.description }
}

/** Same rule for notes. */
export function toSubtopicRequest(values: SubtopicValues): SubtopicRequest {
  return { title: values.title, notes: values.notes === '' ? null : values.notes }
}
