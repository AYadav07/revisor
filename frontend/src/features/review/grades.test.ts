import { describe, expect, it } from 'vitest'
import { gradeTone } from './grades'

describe('gradeTone', () => {
  it("splits grades on SM-2's line: below 3 resets the schedule, 3 and up advance it", () => {
    expect([0, 1, 2, 3, 4, 5].map((quality) => gradeTone(quality as 0 | 1 | 2 | 3 | 4 | 5))).toEqual([
      'fail',
      'fail',
      'hard',
      'pass',
      'pass',
      'pass',
    ])
  })
})
