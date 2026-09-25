import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/api'
import { ForbiddenPage } from '@/components/ForbiddenPage'
import { PageLoading } from '@/components/PageLoading'
import { ROUTES } from '@/routes'
import { redirectTarget } from './redirectTarget'
import { useAuth } from './useAuth'

/** Layout route: renders its children only for a signed-in user, otherwise sends them to /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoading />
  if (status === 'unauthenticated') {
    // `from` lets the login page send them back to where they were headed.
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }
  return <Outlet />
}

/**
 * Layout route for pages restricted to one role, e.g. /admin/users. Nest it inside RequireAuth.
 * This only decides what the UI shows: the backend independently answers 403 to anyone without
 * the role, so bypassing it in the browser gets a user nothing.
 */
export function RequireRole({ role }: { role: Role }) {
  const { status, user } = useAuth()

  if (status === 'loading') return <PageLoading />
  if (user?.role !== role) return <ForbiddenPage />
  return <Outlet />
}

/** Layout route for /login and /signup: a signed-in user has no business there, so bounce them on. */
export function PublicOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoading />
  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />
  return <Outlet />
}
