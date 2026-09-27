import { useState } from 'react'
import { LoadError } from '@/components/LoadError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalDate, todayLocalIso, weekdayShort } from '@/lib/date'
import { pluralize } from '@/lib/plural'
import { cn } from 'cn'
import { forecastDays, type ForecastDay } from './dashboardStats'
import { useForecast } from './useDashboard'

function describeDay(day: ForecastDay): string {
  const reviews = pluralize(day.count, 'review')
  return day.overdue > 0 ? `${reviews}, ${day.overdue} overdue` : reviews
}

/**
 * "Coming up": how many reviews fall on each of the next seven days, so the user can see a heavy
 * day coming. One series, so one color and no legend; each day is focusable and shows its figure
 * on hover or focus, and screen readers get every day's count from its label.
 */
export function ReviewForecast() {
  const forecast = useForecast()
  const [active, setActive] = useState<number | null>(null)

  if (forecast.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton role="status" aria-label="Loading forecast" className="h-40" />
        </CardContent>
      </Card>
    )
  }

  if (forecast.isError) {
    return <LoadError message="Couldn't load your forecast." onRetry={() => forecast.refetch()} retrying={forecast.isFetching} />
  }

  const today = todayLocalIso()
  const days = forecastDays(forecast.data.content, today)
  const max = Math.max(...days.map((day) => day.count), 1)
  const total = forecast.data.totalElements

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Coming up</CardTitle>
        <CardDescription>
          {total === 0 ? 'Nothing scheduled in the next 7 days.' : `${pluralize(total, 'review')} in the next 7 days`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol aria-label="Reviews per day" className="flex h-40 items-stretch gap-0.5 border-b">
          {days.map((day, index) => (
            <li
              key={day.date}
              tabIndex={0}
              aria-label={`${index === 0 ? 'Today' : formatLocalDate(day.date)}: ${describeDay(day)}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              // The whole column is the hover/focus target — far easier to hit than a thin bar.
              className="relative flex flex-1 cursor-default flex-col items-center justify-end rounded-sm outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {active === index && (
                <span
                  aria-hidden
                  className="absolute bottom-full z-10 mb-1 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
                >
                  <span className="block font-medium">{describeDay(day)}</span>
                  <span className="block text-muted-foreground">{formatLocalDate(day.date)}</span>
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  'w-full max-w-6 rounded-t-sm',
                  // An empty day keeps a thin stub, so it reads as "zero" rather than "missing".
                  day.count === 0 ? 'h-0.5 bg-muted-foreground/25' : 'bg-primary',
                )}
                style={day.count === 0 ? undefined : { height: `${(day.count / max) * 100}%` }}
              />
            </li>
          ))}
        </ol>
        <div aria-hidden className="mt-2 flex gap-0.5 text-center text-xs text-muted-foreground">
          {days.map((day, index) => (
            <span key={day.date} className={cn('flex-1', index === 0 && 'font-medium text-foreground')}>
              {index === 0 ? 'Today' : weekdayShort(day.date)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
