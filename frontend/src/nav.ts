import type { Role } from '@/api'
import { ROUTES } from '@/routes'

export interface NavItem {
  to: string
  label: string
  /** Only offered to this role. Hiding a link is a courtesy — the backend enforces access (403). */
  role?: Role
}

/** The AppShell's top-level navigation, in display order (UI_DESIGN.md §3). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard' },
  { to: ROUTES.courses, label: 'Courses' },
  { to: ROUTES.adminUsers, label: 'Admin', role: 'ADMIN' },
]

export function visibleNavItems(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.role === undefined || item.role === role)
}
