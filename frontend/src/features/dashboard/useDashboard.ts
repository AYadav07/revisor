import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type DueParams, type DueRange } from '@/api'
import { dashboardKeys } from './queryKeys'

/** Due items per page on the dashboard. */
export const DUE_PAGE_SIZE = 20

/** The stat tiles: due today, overdue, total learned. */
export function useSummary() {
  return useQuery({ queryKey: dashboardKeys.summary(), queryFn: () => dashboardApi.summary() })
}

/** Learned / total for every course. */
export function useProgress() {
  return useQuery({ queryKey: dashboardKeys.progress(), queryFn: () => dashboardApi.progress() })
}

/** One page of what is due (and overdue), oldest first. `page` is zero-based. */
export function useDueList(range: DueRange, page: number) {
  const params: DueParams = { range, page, size: DUE_PAGE_SIZE }
  return useQuery({
    queryKey: dashboardKeys.due(params),
    queryFn: () => dashboardApi.due(params),
    // Keep the old page on screen while the next one loads — but only within the same range: the
    // "This week" list must not sit under a "Today" heading while it loads.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as DueParams | undefined)?.range === range ? previous : undefined,
  })
}

/** The most due items the forecast reads in one request — the API's page-size cap. */
export const FORECAST_SIZE = 100

/**
 * Everything due in the next seven days (overdue included), for the "Coming up" chart. One request
 * rather than paging: a week of reviews rarely nears the cap, and if it does the chart still shows
 * the true total (from totalElements) while the later days undercount.
 */
export function useForecast() {
  const params: DueParams = { range: 'week', page: 0, size: FORECAST_SIZE }
  return useQuery({ queryKey: dashboardKeys.due(params), queryFn: () => dashboardApi.due(params) })
}
