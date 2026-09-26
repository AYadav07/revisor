import { describe, expect, it } from 'vitest'
import { pageFromSearch } from './pageParam'

describe('pageFromSearch', () => {
  it.each([
    ['1', 0],
    ['2', 1],
    ['10', 9],
    ['3abc', 2],
  ])('?page=%s is zero-based page %i', (value, expected) => {
    expect(pageFromSearch(value)).toBe(expected)
  })

  it.each([null, '', 'abc', '0', '-2', '1.5e3x', ' '])('%j is the first page', (value) => {
    expect(pageFromSearch(value)).toBe(0)
  })
})
