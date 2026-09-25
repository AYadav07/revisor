import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, type AdminUser } from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteUser } from './useAdmin'

interface DeleteUserDialogProps {
  /** The user to delete; the dialog is open exactly when this is set. */
  user: AdminUser | null
  onClose: () => void
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const deleteUser = useDeleteUser()
  const [error, setError] = useState<string | null>(null)

  function close() {
    setError(null)
    onClose()
  }

  function confirm() {
    if (!user) return
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        toast.success(`Deleted ${user.name}`)
        close()
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 404) return close() // already gone; the list refreshes
        setError(
          e instanceof ApiError && e.status === 409
            ? "This user can't be deleted right now. They must be disabled first."
            : "Couldn't delete the user. Please try again.",
        )
      },
    })
  }

  return (
    <ConfirmDialog
      open={user !== null}
      title={user ? `Delete ${user.name}?` : ''}
      description={
        user
          ? `This permanently deletes ${user.email} and all of their courses, review history and sessions. It can't be undone.`
          : ''
      }
      confirmLabel="Delete user"
      pendingLabel="Deleting…"
      pending={deleteUser.isPending}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    />
  )
}
