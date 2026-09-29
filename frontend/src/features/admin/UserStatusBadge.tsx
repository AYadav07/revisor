import { Badge } from '@/components/ui/badge'

interface UserStatusBadgeProps {
  enabled: boolean
  /** Defaults to true, so callers without verification data show just the enabled state. */
  emailVerified?: boolean
}

/**
 * Whether a user can sign in (UI_DESIGN.md §2): success while enabled, destructive once disabled,
 * plus a warning "Unverified" badge for an enabled account that hasn't clicked its email link yet —
 * such a user can't sign in until they do.
 */
export function UserStatusBadge({ enabled, emailVerified = true }: UserStatusBadgeProps) {
  if (!enabled) return <Badge variant="destructive">Disabled</Badge>
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant="success">Active</Badge>
      {!emailVerified && <Badge variant="warning">Unverified</Badge>}
    </span>
  )
}
