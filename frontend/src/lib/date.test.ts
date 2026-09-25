import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLocalDate } from './date'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('formatLocalDate', () => {
  it('formats a date-only string as a short readable date', () => {
    expect(formatLocalDate('2026-09-25')).toMatch(/Sep\D+25\D+2026/)
  })

  // new Date("2026-09-25") is UTC midnight, which is the 24th on the wall clock west of Greenwich.
  it.each(['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Asia/Kolkata', 'Pacific/Kiritimati'])(
    'shows the same calendar day in %s',
    (timeZone) => {
      vi.stubEnv('TZ', timeZone)
      expect(formatLocalDate('2026-09-25')).toMatch(/Sep\D+25\D+2026/)
      expect(formatLocalDate('2026-01-01')).toMatch(/Jan\D+1\D+2026/)
    },
  )
})
