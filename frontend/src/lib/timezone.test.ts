import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectTimezone } from './timezone'

afterEach(() => vi.restoreAllMocks())

describe('detectTimezone', () => {
  it("returns the browser's IANA timezone", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Kolkata',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(detectTimezone()).toBe('Asia/Kolkata')
  })

  it('reports a real value in this environment', () => {
    expect(detectTimezone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+)*$/)
  })

  it('falls back to UTC when the browser reports nothing', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(detectTimezone()).toBe('UTC')
  })
})
