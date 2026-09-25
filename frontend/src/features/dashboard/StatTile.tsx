import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'

interface StatTileProps {
  label: string
  value: number
  /** Draws the number in the destructive color, for a figure that should worry the user (overdue). */
  alert?: boolean
}

export function StatTile({ label, value, alert = false }: StatTileProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn('text-3xl', alert && 'text-destructive')}>{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
