import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** Page-level actions, e.g. a "New course" button, shown at the right. */
  actions?: ReactNode
}

/** The heading row at the top of a page: its <h1> and its primary actions. */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {actions}
    </div>
  )
}
