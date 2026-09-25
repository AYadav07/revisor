import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLocalDate, todayLocalIso } from './date'

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

describe('todayLocalIso', () => {
  it('pads month and day', () => {
    expect(todayLocalIso(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(todayLocalIso(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
  })

  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 on the 25th in Los Angeles is already the 26th in UTC.
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(todayLocalIso(new Date('2026-09-26T06:30:00Z'))).toBe('2026-09-25')
    vi.stubEnv('TZ', 'Pacific/Kiritimati')
    expect(todayLocalIso(new Date('2026-09-26T06:30:00Z'))).toBe('2026-09-26')
  })

  it('uses the local year too, across New Year', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // 19:00 on New Year's Eve in Los Angeles is already 2027 in UTC.
    expect(todayLocalIso(new Date('2027-01-01T03:00:00Z'))).toBe('2026-12-31')
  })

  it('sorts as a string the way dates sort as dates', () => {
    expect(todayLocalIso(new Date(2026, 8, 26)) >= '2026-09-26').toBe(true)
    expect(todayLocalIso(new Date(2026, 8, 26)) >= '2026-09-27').toBe(false)
    expect(todayLocalIso(new Date(2026, 8, 26)) >= '2025-12-31').toBe(true)
  })
})
