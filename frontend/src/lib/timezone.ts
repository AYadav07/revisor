/**
 * The browser's IANA timezone, e.g. "Asia/Kolkata". Captured silently at signup and sent to the
 * backend, which uses it to work out what "today" means for scheduling (API.md, UI_DESIGN.md §6).
 * Falls back to UTC in the rare browser that can't report one.
 */
export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
