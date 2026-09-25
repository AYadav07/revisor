import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { AdminUser } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { pageFromSearch } from '@/lib/pageParam'
import { DeleteUserDialog } from './DeleteUserDialog'
import { UserCoursesDialog } from './UserCoursesDialog'
import { UserSearchForm } from './UserSearchForm'
import { UserTable } from './UserTable'
import { ADMIN_PAGE_SIZE, useAdminUsers, useSetUserEnabled } from './useAdmin'

type Dialog = { type: 'delete'; user: AdminUser } | { type: 'courses'; user: AdminUser }

/** `/admin/users` (ADMIN only): find users, disable or re-enable them, delete disabled ones, see their courses. */
export function UsersPage() {
  const { user: me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // Search and page live in the URL, so refresh, Back and shared links all land on the same view.
  const q = (searchParams.get('q') ?? '').trim()
  const page = pageFromSearch(searchParams.get('page'))
  const users = useAdminUsers(q, page)
  const setEnabled = useSetUserEnabled()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const closeDialog = () => setDialog(null)

  function search(next: string) {
    setSearchParams(next ? { q: next } : {})
  }

  function goToPage(next: number) {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (next > 0) params.page = String(next + 1)
    setSearchParams(params)
  }

  function toggle(target: AdminUser) {
    const enabled = !target.enabled
    setEnabled.mutate(
      { userId: target.id, enabled },
      {
        onSuccess: () => toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${target.name}`),
        onError: () => toast.error("Couldn't update the user. Please try again."),
      },
    )
  }

  return (
    <>
      <PageHeader title="Users" description="Everyone with an account. Deleting a user requires disabling them first." />
      <UserSearchForm key={q} q={q} onSearch={search} />

      {users.isPending && (
        <div role="status" aria-label="Loading users" className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}

      {users.isError && (
        <LoadError message="Couldn't load users." onRetry={() => users.refetch()} retrying={users.isFetching} />
      )}

      {users.data && users.data.totalElements === 0 && (
        <EmptyState
          title={q ? 'No matching users' : 'No users'}
          description={q ? `Nobody's name or email matches “${q}”.` : 'There are no users yet.'}
          action={q ? <Button onClick={() => search('')}>Clear search</Button> : undefined}
        />
      )}

      {/* Past the last page (the list shrank after deletions): don't leave a blank table. */}
      {users.data && users.data.totalElements > 0 && users.data.content.length === 0 && (
        <EmptyState
          title="No users on this page"
          description="This page is past the end of the list."
          action={<Button onClick={() => goToPage(0)}>Go to the first page</Button>}
        />
      )}

      {users.data && users.data.content.length > 0 && (
        <>
          <UserTable
            users={users.data.content}
            currentUserId={me?.id}
            togglingId={setEnabled.isPending ? setEnabled.variables.userId : null}
            onToggle={toggle}
            onDelete={(target) => setDialog({ type: 'delete', user: target })}
            onViewCourses={(target) => setDialog({ type: 'courses', user: target })}
          />
          <Pagination page={page} totalPages={Math.ceil(users.data.totalElements / ADMIN_PAGE_SIZE)} onPageChange={goToPage} />
        </>
      )}

      <DeleteUserDialog user={dialog?.type === 'delete' ? dialog.user : null} onClose={closeDialog} />
      <UserCoursesDialog user={dialog?.type === 'courses' ? dialog.user : null} onClose={closeDialog} />
    </>
  )
}
