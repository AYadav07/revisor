import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description: string
  /** The next step, usually a button. */
  action?: ReactNode
  icon?: LucideIcon
}

/** What a list shows when there is nothing in it yet: say why, and offer the way forward. */
export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps) {
  return (
    <Card className="items-center border-dashed py-10 text-center shadow-none">
      {Icon && (
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
      )}
      <CardHeader className="w-full">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action && <CardContent className="flex justify-center">{action}</CardContent>}
    </Card>
  )
}
