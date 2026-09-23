import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { PublicOnly, RequireAuth } from '@/features/auth/RouteGuards'
import { SignupPage } from '@/features/auth/SignupPage'
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
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        </Route>
        {/* Anything else: try the landing page, and RequireAuth sends signed-out users to /login. */}
        <Route path="*" element={<Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  )
}

export default App
