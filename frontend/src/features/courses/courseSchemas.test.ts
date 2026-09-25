import { describe, expect, it } from 'vitest'
import { courseSchema, toCourseRequest } from './courseSchemas'

describe('courseSchema', () => {
  it('accepts a title alone, with an empty description', () => {
    expect(courseSchema.safeParse({ title: 'System Design', description: '' }).success).toBe(true)
  })

  it('trims both fields', () => {
    expect(courseSchema.parse({ title: '  DSA ', description: '  arrays  ' })).toEqual({
      title: 'DSA',
      description: 'arrays',
    })
  })

  it('requires a title, treating whitespace as empty', () => {
    const result = courseSchema.safeParse({ title: '   ', description: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Title is required')
  })

  it("enforces the backend's limits: 255 for the title, 2000 for the description", () => {
    expect(courseSchema.safeParse({ title: 't'.repeat(255), description: '' }).success).toBe(true)
    expect(courseSchema.safeParse({ title: 't'.repeat(256), description: '' }).success).toBe(false)
    expect(courseSchema.safeParse({ title: 't', description: 'd'.repeat(2000) }).success).toBe(true)
    expect(courseSchema.safeParse({ title: 't', description: 'd'.repeat(2001) }).success).toBe(false)
  })
})

describe('toCourseRequest', () => {
  it('sends a blank description as null, so "no description" has one representation', () => {
    expect(toCourseRequest({ title: 'DSA', description: '' })).toEqual({ title: 'DSA', description: null })
  })

  it('passes a real description through', () => {
    expect(toCourseRequest({ title: 'DSA', description: 'arrays' })).toEqual({ title: 'DSA', description: 'arrays' })
  })
})
