import { describe, expect, it } from 'vitest'
import { userSearchSchema } from './adminSchemas'

describe('userSearchSchema', () => {
  it('trims the search', () => {
    expect(userSearchSchema.parse({ q: '  ann  ' })).toEqual({ q: 'ann' })
  })

  it('allows blank, which means everyone', () => {
    expect(userSearchSchema.safeParse({ q: '' }).success).toBe(true)
    expect(userSearchSchema.parse({ q: '   ' })).toEqual({ q: '' })
  })

  it('caps the length at 100', () => {
    expect(userSearchSchema.safeParse({ q: 'a'.repeat(100) }).success).toBe(true)
    const tooLong = userSearchSchema.safeParse({ q: 'a'.repeat(101) })
    expect(tooLong.success).toBe(false)
  })
})
