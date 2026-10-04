import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface EmailLinkResultProps {
  status: 'success' | 'error'
  title: string
  children: ReactNode
  /** Buttons or links under the message: sign in, request a new link, ... */
  actions: ReactNode
}

/**
 * The outcome of following an emailed link (UI_DESIGN.md's TokenResultCard): a success or error
 * message in its state color, and what to do next.
 */
export function EmailLinkResult({ status, title, children, actions }: EmailLinkResultProps) {
  const success = status === 'success'
  return (
    <div className="space-y-4">
      <Alert variant={success ? 'default' : 'destructive'} className={success ? 'border-success/40' : undefined}>
        {success ? <CircleCheck className="text-success" /> : <CircleAlert />}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">{actions}</div>
    </div>
  )
}
