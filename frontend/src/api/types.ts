/**
 * Wire types for the backend API — API.md is the contract, and each shape below mirrors the
 * corresponding Java record. Dates are ISO strings (`LocalDate` → "2026-09-25", `Instant` →
 * "2026-09-22T20:03:04.559Z"); nullable Java fields are `| null`, since the backend serializes
 * absent values as explicit nulls rather than omitting them.
 */

// ---- Errors (RFC 7807 Problem Details, API.md "Conventions") ----

export interface FieldError {
  field: string
  message: string
}

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  /** Present on validation failures (400). */
  errors?: FieldError[]
}

// ---- Pagination ----

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
}

export interface PageParams {
  page?: number
  size?: number
}

// ---- Auth ----

export type Role = 'USER' | 'ADMIN'

/** The user shape clients get on signup/login/refresh: no timezone, hash or timestamps. */
export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
}

export interface SessionResponse {
  user: AuthUser
}

export interface SignupRequest {
  name: string
  email: string
  password: string
  /** IANA id, e.g. "Asia/Kolkata" — captured silently at signup (UI_DESIGN.md §6). */
  timezone: string
}

export interface LoginRequest {
  email: string
  password: string
}

// ---- Courses / topics / subtopics ----

export interface CourseRequest {
  title: string
  description?: string | null
}

export interface CourseResponse {
  id: number
  title: string
  description: string | null
}

export interface TopicRequest {
  title: string
  orderIndex: number
}

export interface TopicResponse {
  id: number
  courseId: number
  title: string
  orderIndex: number
}

export interface SubtopicRequest {
  title: string
  notes?: string | null
}

export interface SubtopicResponse {
  id: number
  topicId: number
  title: string
  notes: string | null
}

/** `GET /courses/{id}`: the whole tree in one call (API.md). */
export interface SubtopicTreeNode {
  id: number
  title: string
  notes: string | null
  learned: boolean
  /** Null exactly when `learned` is false. */
  nextReviewDate: string | null
}

export interface TopicTreeNode {
  id: number
  title: string
  orderIndex: number
  subtopics: SubtopicTreeNode[]
}

export interface CourseTree {
  id: number
  title: string
  description: string | null
  topics: TopicTreeNode[]
}

// ---- Learning & review ----

/** 0 = Blackout … 5 = Perfect (UI_DESIGN.md §4). */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5

export interface LearnResponse {
  subtopicId: number
  learnedAt: string
  nextReviewDate: string
}

export interface ReviewResponse {
  subtopicId: number
  easeFactor: number
  intervalDays: number
  nextReviewDate: string
  repetitionCount: number
}

// ---- Dashboard ----

export type DueRange = 'today' | 'week'

export interface DueParams extends PageParams {
  range?: DueRange
}

export interface DueItem {
  subtopicId: number
  subtopicTitle: string
  topicId: number
  topicTitle: string
  courseId: number
  courseTitle: string
  nextReviewDate: string
  /** 0 for anything due today or later, in the user's own timezone. */
  daysOverdue: number
}

export interface CourseProgress {
  courseId: number
  courseTitle: string
  learnedCount: number
  totalCount: number
}

export interface DashboardSummary {
  dueToday: number
  overdue: number
  totalLearned: number
}

// ---- Admin ----

/** Admin's richer view of a user (includes fields AuthUser deliberately leaves out). */
export interface AdminUser {
  id: number
  name: string
  email: string
  role: Role
  enabled: boolean
  timezone: string
  createdAt: string
}

export interface AdminUsersParams extends PageParams {
  /** Case-insensitive match on name or email; omit to list everyone. */
  q?: string
}

export interface UserCourseProgress {
  courseId: number
  title: string
  description: string | null
  learnedCount: number
  totalCount: number
}
