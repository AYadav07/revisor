import { describe, expect, it } from 'vitest'
import { visibleNavItems } from './nav'

const labels = (role: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(role).map((item) => item.label)

describe('visibleNavItems', () => {
  it('gives a normal user the shared links only', () => {
    expect(labels('USER')).toEqual(['Dashboard', 'Courses'])
  })

  it('adds the Admin link, last, for an admin', () => {
    expect(labels('ADMIN')).toEqual(['Dashboard', 'Courses', 'Admin'])
  })

  it('shows no role-restricted link when the role is unknown', () => {
    expect(labels(undefined)).toEqual(['Dashboard', 'Courses'])
  })
})
