import type { LucideIcon } from 'lucide-react'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'

/** The state a figure is about, in the app's state colors (UI_DESIGN.md §2). */
export type StatTone = 'neutral' | 'warning' | 'destructive' | 'success'

/** The tile itself: a soft wash and border in the state's color. */
const SURFACES: Record<StatTone, string> = {
  neutral: '',
  warning: 'border-warning/30 bg-warning/10',
  destructive: 'border-destructive/30 bg-destructive/10',
  success: 'border-success/30 bg-success/10',
}

/** The icon chip: solid state color. */
const CHIPS: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-white',
  success: 'bg-success text-success-foreground',
}

interface StatTileProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: StatTone
  /** Draws the number in the destructive color, for a figure that should worry the user (overdue). */
  alert?: boolean
}

export function StatTile({ label, value, icon: Icon, tone = 'neutral', alert = false }: StatTileProps) {
  return (
    <Card className={cn('flex-row items-center gap-4 px-6 py-5', SURFACES[tone])}>
      <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm', CHIPS[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn('mt-1 text-3xl tracking-tight', alert && 'text-destructive')}>{value}</CardTitle>
      </div>
    </Card>
  )
}
