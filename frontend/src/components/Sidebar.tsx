import { Repeat2 } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { SidebarCourses } from '@/components/SidebarCourses'
import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/useAuth'
import { useSummary } from '@/features/dashboard/useDashboard'
import { visibleNavItems } from '@/nav'
import { ROUTES } from '@/routes'

/**
 * The sidebar's contents (UI_DESIGN.md §3): brand, main navigation, the user's courses and the
 * account menu. Rendered fixed beside the page on large screens and in a slide-in sheet on small
 * ones; `onNavigate` lets the sheet close when a link is followed.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  // Shares the dashboard's cached summary. Due today plus overdue: everything reviewable right now.
  const summary = useSummary().data
  const dueNow = summary ? summary.dueToday + summary.overdue : 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link
          to={ROUTES.dashboard}
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md text-lg font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Repeat2 className="size-5" />
          </span>
          Revisor
        </Link>
      </div>

      <nav aria-label="Main" className="space-y-0.5 px-3 py-2">
        {visibleNavItems(user?.role).map(({ to, label, icon: Icon }) => (
          // NavLink marks the current page with aria-current="page", which the classes below style.
          <Button
            key={to}
            asChild
            variant="ghost"
            className="w-full justify-start gap-3 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
          >
            <NavLink
              to={to}
              onClick={onNavigate}
              // With the due badge showing, name the link explicitly: text from inline elements would
              // otherwise run together ("Dashboard3").
              aria-label={to === ROUTES.dashboard && dueNow > 0 ? `${label}, ${dueNow} due` : undefined}
            >
              <Icon aria-hidden />
              {label}
              {to === ROUTES.dashboard && dueNow > 0 && (
                <span
                  aria-hidden
                  className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums"
                >
                  {dueNow}
                </span>
              )}
            </NavLink>
          </Button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <SidebarCourses onNavigate={onNavigate} />
      </div>

      <div className="border-t p-3">
        <UserMenu />
      </div>
    </div>
  )
}
