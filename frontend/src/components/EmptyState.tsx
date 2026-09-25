import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description: string
  /** The next step, usually a button. */
  action?: ReactNode
}

/** What a list shows when there is nothing in it yet: say why, and offer the way forward. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action && <CardContent className="flex justify-center">{action}</CardContent>}
    </Card>
  )
}
