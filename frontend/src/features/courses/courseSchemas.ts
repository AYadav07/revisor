import { z } from 'zod'
import type { CourseRequest } from '@/api'

/**
 * Mirrors the backend's CourseRequest validation (title @NotBlank @Size(max=255), description
 * @Size(max=2000)) — the server stays the authority; this gives instant feedback (UI_DESIGN.md §6).
 * The limits are the backend's, not the illustrative ones in UI_DESIGN.md's example.
 */
export const courseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be at most 255 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters'),
})

export type CourseValues = z.infer<typeof courseSchema>

/** A blank description is sent as null rather than an empty string, so "no description" is one thing. */
export function toCourseRequest(values: CourseValues): CourseRequest {
  return { title: values.title, description: values.description === '' ? null : values.description }
}
