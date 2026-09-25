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
