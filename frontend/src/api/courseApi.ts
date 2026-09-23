import { apiFetch } from './client'
import type {
  CourseRequest,
  CourseResponse,
  CourseTree,
  PageParams,
  PageResponse,
  SubtopicRequest,
  SubtopicResponse,
  TopicRequest,
  TopicResponse,
} from './types'

/**
 * Courses, topics and subtopics. Anything that isn't the caller's own comes back as 404,
 * never 403 (API.md) — so a 404 here can mean "doesn't exist" or "not yours".
 */
export const courseApi = {
  listCourses: (params: PageParams = {}) =>
    apiFetch<PageResponse<CourseResponse>>('/courses', { query: { ...params } }),

  /** The whole tree (topics + subtopics, with learned/nextReviewDate) in one call. */
  getCourse: (id: number) => apiFetch<CourseTree>(`/courses/${id}`),

  createCourse: (body: CourseRequest) =>
    apiFetch<CourseResponse>('/courses', { method: 'POST', body }),

  updateCourse: (id: number, body: CourseRequest) =>
    apiFetch<CourseResponse>(`/courses/${id}`, { method: 'PUT', body }),

  /** Hard delete: takes the course's whole tree and its review history with it. */
  deleteCourse: (id: number) => apiFetch<void>(`/courses/${id}`, { method: 'DELETE' }),

  createTopic: (courseId: number, body: TopicRequest) =>
    apiFetch<TopicResponse>(`/courses/${courseId}/topics`, { method: 'POST', body }),

  getTopic: (id: number) => apiFetch<TopicResponse>(`/topics/${id}`),

  updateTopic: (id: number, body: TopicRequest) =>
    apiFetch<TopicResponse>(`/topics/${id}`, { method: 'PUT', body }),

  /** Soft delete; also soft-deletes the topic's subtopics. */
  deleteTopic: (id: number) => apiFetch<void>(`/topics/${id}`, { method: 'DELETE' }),

  createSubtopic: (topicId: number, body: SubtopicRequest) =>
    apiFetch<SubtopicResponse>(`/topics/${topicId}/subtopics`, { method: 'POST', body }),

  getSubtopic: (id: number) => apiFetch<SubtopicResponse>(`/subtopics/${id}`),

  updateSubtopic: (id: number, body: SubtopicRequest) =>
    apiFetch<SubtopicResponse>(`/subtopics/${id}`, { method: 'PUT', body }),

  /** Soft delete. */
  deleteSubtopic: (id: number) => apiFetch<void>(`/subtopics/${id}`, { method: 'DELETE' }),
}
