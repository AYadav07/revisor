import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** A line under the title, e.g. what a course is about. */
  description?: string | null
  /** Page-level actions, e.g. a "New course" button, shown at the right. */
  actions?: ReactNode
  /** Shown before the title, e.g. a course's badge. */
  leading?: ReactNode
}

/** The heading row at the top of a page: its <h1>, an optional description, and its primary actions. */
export function PageHeader({ title, description, actions, leading }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}
