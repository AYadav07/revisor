import { Link, NavLink, Outlet } from 'react-router-dom'
import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/useAuth'
import { visibleNavItems } from '@/nav'
import { ROUTES } from '@/routes'

/**
 * Persistent layout for every authenticated page (UI_DESIGN.md §3): a top bar with the logo,
 * the main navigation and the user menu, with the page itself rendered below via <Outlet />.
 */
export function AppShell() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Button asChild variant="link" className="px-0 text-lg font-semibold no-underline hover:no-underline">
            <Link to={ROUTES.dashboard}>Revisor</Link>
          </Button>
          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            {visibleNavItems(user?.role).map((item) => (
              // NavLink marks the current page with aria-current="page", which the class below styles.
              <Button key={item.to} asChild variant="ghost" size="sm" className="aria-[current=page]:bg-accent">
                <NavLink to={item.to}>{item.label}</NavLink>
              </Button>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
