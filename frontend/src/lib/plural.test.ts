import { describe, expect, it } from 'vitest'
import { pluralize } from './plural'

describe('pluralize', () => {
  it.each([
    [0, '0 topics'],
    [1, '1 topic'],
    [2, '2 topics'],
    [12, '12 topics'],
  ])('%i → %s', (count, expected) => {
    expect(pluralize(count, 'topic')).toBe(expected)
  })
})
