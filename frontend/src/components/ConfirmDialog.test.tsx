import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Delete it?"
      description="This can't be undone."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      pending={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel, user: userEvent.setup() }
}

describe('ConfirmDialog', () => {
  it('states what will happen and offers confirm and cancel', () => {
    setup()

    const dialog = screen.getByRole('dialog', { name: 'Delete it?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('renders nothing while closed', () => {
    setup({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirms and cancels through their own buttons only', async () => {
    const { user, onConfirm, onCancel } = setup()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', async () => {
    const { user, onCancel } = setup()

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows a failure and stays available for a retry', () => {
    setup({ error: 'Nope.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Nope.')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('while pending: disables both buttons, shows the pending label, and ignores Escape', async () => {
    const { user, onCancel } = setup({ pending: true })

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })
})
