import type { AdminUser } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTimestampDate } from '@/lib/date'
import { UserStatusBadge } from './UserStatusBadge'

interface UserTableProps {
  users: readonly AdminUser[]
  /** The signed-in admin: their own row offers no actions, since the API refuses them (409). */
  currentUserId: number | undefined
  /** The user whose enable/disable request is in flight, if any. */
  togglingId: number | null
  onToggle: (user: AdminUser) => void
  onDelete: (user: AdminUser) => void
  onViewCourses: (user: AdminUser) => void
}

export function UserTable({ users, currentUserId, togglingId, onToggle, onDelete, onViewCourses }: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          return (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.name}
                {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role === 'ADMIN' ? 'Admin' : 'User'}</Badge>
              </TableCell>
              <TableCell>
                <UserStatusBadge enabled={user.enabled} />
              </TableCell>
              <TableCell>{formatTimestampDate(user.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" aria-label={`View ${user.name}'s courses`} onClick={() => onViewCourses(user)}>
                    Courses
                  </Button>
                  {!isSelf && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`${user.enabled ? 'Disable' : 'Enable'} ${user.name}`}
                        disabled={togglingId === user.id}
                        onClick={() => onToggle(user)}
                      >
                        {user.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${user.name}`}
                        // Deleting is a second step after disabling (API.md): the API answers 409 otherwise.
                        disabled={user.enabled}
                        title={user.enabled ? 'Disable this user before deleting them' : undefined}
                        onClick={() => onDelete(user)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
