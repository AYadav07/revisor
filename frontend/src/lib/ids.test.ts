import { describe, expect, it } from 'vitest'
import { parseIdParam } from './ids'

describe('parseIdParam', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('accepts %s', (param, expected) => {
    expect(parseIdParam(param)).toBe(expected)
  })

  it.each([undefined, '', 'abc', '0', '-3', '1.5', '007', ' 1', '1 ', '1e3', '9007199254740993'])(
    'rejects %j',
    (param) => {
      expect(parseIdParam(param)).toBeNull()
    },
  )
})
