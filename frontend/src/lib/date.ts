/**
 * Formats a backend `LocalDate` ("2026-09-25") for display, e.g. "Sep 25, 2026".
 *
 * The parts are read by hand and built as a *local* date on purpose. `new Date("2026-09-25")`
 * parses a date-only string as UTC midnight, which in any timezone behind UTC is still the
 * 24th — the schedule would show as a day early for anyone west of Greenwich.
 */
export function formatLocalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Today's date in the browser's timezone as "YYYY-MM-DD", comparable as a string with backend dates. */
export function todayLocalIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Formats a backend timestamp ("2026-09-20T10:15:00Z") as a short date in the browser's timezone. */
export function formatTimestampDate(isoInstant: string): string {
  return new Date(isoInstant).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** An ISO date ("YYYY-MM-DD") moved by `days`, computed on the calendar (no timezone involved). */
export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return todayLocalIso(new Date(year, month - 1, day + days))
}

/** A short weekday name for an ISO date, e.g. "Mon", read as a local calendar date. */
export function weekdayShort(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' })
}
