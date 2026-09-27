import { Menu } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ContentLoading } from '@/components/ContentLoading'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/**
 * Persistent layout for every authenticated page (UI_DESIGN.md §3): a fixed sidebar on large
 * screens, and on small ones a top bar whose menu button slides the same sidebar in. The page
 * itself renders via <Outlet /> across the remaining width.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 bg-sidebar lg:block">
        <Sidebar />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-sidebar px-4 text-white lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="hover:bg-sidebar-accent hover:text-white">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="border-sidebar-border bg-sidebar text-sidebar-foreground">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Revisor</span>
        </header>

        <main className="w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {/* Pages load on demand: the shell stays while one loads, and a failed load is contained here. */}
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<ContentLoading />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
