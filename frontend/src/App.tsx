import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/RouteGuards'
import { SignupPage } from '@/features/auth/SignupPage'
import { CoursesPage } from '@/features/courses/CoursesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DEFAULT_AUTHENTICATED_PATH, ROUTES } from '@/routes'

/** Providers that need the router and query client are mounted above this, in main.tsx. */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.signup} element={<SignupPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.courses} element={<CoursesPage />} />
            {/* TEMPORARY placeholders, replaced as each screen is built. */}
            <Route path={ROUTES.courseDetail} element={<PlaceholderPage title="Course" />} />
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path={ROUTES.adminUsers} element={<PlaceholderPage title="Users" />} />
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
