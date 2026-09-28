/** Route paths in one place, so a rename or a redirect target can't drift from the router. */
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  /** "Check your inbox" after signup or an unverified sign-in, with a resend button. */
  checkEmail: '/check-email',
  /** Where the emailed verification link lands (`?token=`). */
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  /** Where the emailed reset link lands (`?token=`). */
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  courses: '/courses',
  /** The route pattern, for the router. Use {@link courseDetailPath} to build a link. */
  courseDetail: '/courses/:id',
  /** The route pattern, for the router. Use {@link reviewPath} to build a link. */
  review: '/subtopics/:id/review',
  adminUsers: '/admin/users',
} as const

export function courseDetailPath(id: number): string {
  return `/courses/${id}`
}

export function reviewPath(subtopicId: number): string {
  return `/subtopics/${subtopicId}/review`
}

/** Where a signed-in user lands when nothing more specific was asked for. */
export const DEFAULT_AUTHENTICATED_PATH = ROUTES.dashboard
