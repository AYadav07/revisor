import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface LoadErrorProps {
  message: string
  onRetry: () => void
  retrying: boolean
}

/** A failed load, with the one thing the user can do about it. */
export function LoadError({ message, onRetry, retrying }: LoadErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex items-center justify-between gap-4">
        {message}
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
