import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/RouteGuards'
import { SignupPage } from '@/features/auth/SignupPage'
import { CheckEmailPage } from '@/features/auth/CheckEmailPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { DEFAULT_AUTHENTICATED_PATH, ROUTES } from '@/routes'

// Each screen behind the shell is its own chunk, fetched when first visited, so signing in doesn't
// download the admin screen (and its table) for someone who will never open it. Sign-in and sign-up
// stay in the main bundle: they're the first thing a new visitor sees.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CoursesPage = lazy(() => import('@/features/courses/CoursesPage').then((m) => ({ default: m.CoursesPage })))
const CourseDetailPage = lazy(() => import('@/features/courses/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })))
const ReviewPage = lazy(() => import('@/features/review/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const UsersPage = lazy(() => import('@/features/admin/UsersPage').then((m) => ({ default: m.UsersPage })))

/** Providers that need the router and query client are mounted above this, in main.tsx. */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.signup} element={<SignupPage />} />
          <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        </Route>
        {/* Emailed links work whether or not someone is signed in on this browser: a link is about
            the account it was sent to, not the current session. */}
        <Route path={ROUTES.checkEmail} element={<CheckEmailPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.courses} element={<CoursesPage />} />
            <Route path={ROUTES.courseDetail} element={<CourseDetailPage />} />
            <Route path={ROUTES.review} element={<ReviewPage />} />
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path={ROUTES.adminUsers} element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
        {/* Anything else: try the landing page, and RequireAuth sends signed-out users to /login. */}
        <Route path="*" element={<Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  )
}

export default App
