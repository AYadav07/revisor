import { Badge } from '@/components/ui/badge'

/** Whether a user can sign in: success while enabled, destructive once disabled (UI_DESIGN.md §2). */
export function UserStatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Disabled</Badge>
}
