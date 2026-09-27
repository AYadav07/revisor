import type { LucideIcon } from 'lucide-react'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'

/** The state a figure is about, in the app's state colors (UI_DESIGN.md §2). */
export type StatTone = 'neutral' | 'warning' | 'destructive' | 'success'

const TONES: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-success/15 text-success',
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
    <Card className="flex-row items-center gap-4 px-6 py-5">
      <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn('mt-1 text-3xl tracking-tight', alert && 'text-destructive')}>{value}</CardTitle>
      </div>
    </Card>
  )
}
