/**
 * Reads the one-based `?page=N` of a list URL as the API's zero-based page. Anything that isn't a
 * positive whole number ("abc", "0", "-2", missing) is the first page.
 */
export function pageFromSearch(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed - 1 : 0
}
