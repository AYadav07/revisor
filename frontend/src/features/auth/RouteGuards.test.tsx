import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ann, authValue } from '@/test/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { PublicOnly, RequireAuth, RequireRole } from './RouteGuards'

function Where() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  return (
    <p>
      at {location.pathname}
      {from ? ` from ${from.pathname}${from.search}` : ''}
    </p>
  )
}

function renderAt(path: string, auth: AuthContextValue, state?: unknown) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<Where />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/private" element={<p>secret page</p>} />
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="/admin" element={<p>admin page</p>} />
            </Route>
          </Route>
          <Route path="/dashboard" element={<Where />} />
          {/* Deliberately NOT under RequireAuth, to exercise RequireRole's own behaviour. */}
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/standalone-admin" element={<p>standalone admin page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('shows a loading state, not the page and not a redirect, while the session is being restored', () => {
    renderAt('/private', authValue({ status: 'loading' }))

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })

  it('renders the page for a signed-in user', () => {
    renderAt('/private', authValue({ status: 'authenticated', user: ann }))

    expect(screen.getByText('secret page')).toBeInTheDocument()
  })

  it('sends a signed-out user to /login, remembering where they were headed (including the query string)', () => {
    renderAt('/private?tab=due', authValue({ status: 'unauthenticated' }))

    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
    expect(screen.getByText('at /login from /private?tab=due')).toBeInTheDocument()
  })
})

describe('PublicOnly', () => {
  it('shows the login page to a signed-out user', () => {
    renderAt('/login', authValue({ status: 'unauthenticated' }))

    expect(screen.getByText('at /login')).toBeInTheDocument()
  })

  it('shows a loading state while the session is being restored, rather than flashing the form', () => {
    renderAt('/login', authValue({ status: 'loading' }))

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('at /login')).not.toBeInTheDocument()
  })

  it('bounces a signed-in user to the dashboard', () => {
    renderAt('/login', authValue({ status: 'authenticated', user: ann }))

    expect(screen.getByText('at /dashboard')).toBeInTheDocument()
  })

  it('bounces a signed-in user back to the page they were originally headed for', () => {
    renderAt('/login', authValue({ status: 'authenticated', user: ann }), {
      from: { pathname: '/dashboard', search: '?range=week', hash: '' },
    })

    expect(screen.getByText('at /dashboard')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  const admin = { ...ann, role: 'ADMIN' as const }

  it('lets a user with the role through', () => {
    renderAt('/admin', authValue({ status: 'authenticated', user: admin }))

    expect(screen.getByText('admin page')).toBeInTheDocument()
  })

  it('shows "Not authorized" — not the page, and not a redirect to login — to a signed-in user without it', () => {
    renderAt('/admin', authValue({ status: 'authenticated', user: ann }))

    expect(screen.queryByText('admin page')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Not authorized')
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('still sends a signed-out visitor to /login first, via RequireAuth', () => {
    renderAt('/admin', authValue({ status: 'unauthenticated' }))

    expect(screen.getByText('at /login from /admin')).toBeInTheDocument()
  })

  it('waits, rather than declaring anyone unauthorized, while the session is still being restored', () => {
    renderAt('/admin', authValue({ status: 'loading' }))

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // While loading there is no user yet, so without its own check RequireRole would flash "Not
  // authorized" at an admin about to be restored. RequireAuth above normally hides that, so this
  // renders RequireRole on its own to prove it is safe even if the nesting rule is ever broken.
  it('holds back its own verdict during loading even with no RequireAuth above it', () => {
    renderAt('/standalone-admin', authValue({ status: 'loading' }))

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
