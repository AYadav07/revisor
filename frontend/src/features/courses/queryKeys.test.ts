import { describe, expect, it } from 'vitest'
import { courseKeys } from './queryKeys'

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => JSON.stringify(key[index]) === JSON.stringify(part))

describe('courseKeys', () => {
  it('nests every page of the list under lists(), so one invalidation covers all of them', () => {
    expect(startsWith(courseKeys.list({ page: 0, size: 12 }), courseKeys.lists())).toBe(true)
    expect(startsWith(courseKeys.list({ page: 5, size: 12 }), courseKeys.lists())).toBe(true)
  })

  it('gives different pages different keys', () => {
    expect(courseKeys.list({ page: 0, size: 12 })).not.toEqual(courseKeys.list({ page: 1, size: 12 }))
  })

  it('keeps list keys and detail keys apart, so a list invalidation never touches an open course tree', () => {
    expect(startsWith(courseKeys.detail(3), courseKeys.lists())).toBe(false)
    expect(startsWith(courseKeys.list({ page: 0 }), courseKeys.details())).toBe(false)
  })

  it('distinguishes one course tree from another', () => {
    expect(courseKeys.detail(1)).not.toEqual(courseKeys.detail(2))
  })
})
