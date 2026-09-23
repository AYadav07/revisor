import { Navigate, Outlet, useLocation } from 'react-router-dom'
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

/** Layout route for /login and /signup: a signed-in user has no business there, so bounce them on. */
export function PublicOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoading />
  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />
  return <Outlet />
}
