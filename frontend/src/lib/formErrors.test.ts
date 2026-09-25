import type { UseFormReturn } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { showApiError } from './formErrors'

interface Values {
  title: string
  notes: string
}

function setup() {
  const setError = vi.fn()
  const setFormError = vi.fn()
  const form = { setError } as unknown as UseFormReturn<Values>
  return { setError, setFormError, form }
}

const validation = (...errors: { field: string; message: string }[]) =>
  new ApiError(400, 'Validation failed', {
    type: 't',
    title: 'T',
    status: 400,
    detail: 'Validation failed',
    instance: '/x',
    errors,
  })

const GENERIC = 'Something went wrong.'

describe('showApiError', () => {
  it('puts each 400 message on the field it names', () => {
    const { setError, setFormError, form } = setup()

    showApiError(
      validation({ field: 'title', message: 'too long' }, { field: 'notes', message: 'too long too' }),
      form,
      ['title', 'notes'],
      setFormError,
      GENERIC,
    )

    expect(setError).toHaveBeenCalledWith('title', { type: 'server', message: 'too long' })
    expect(setError).toHaveBeenCalledWith('notes', { type: 'server', message: 'too long too' })
    expect(setFormError).not.toHaveBeenCalled()
  })

  it('falls back to a form-level message when the 400 names no field on this form', () => {
    const { setError, setFormError, form } = setup()

    showApiError(validation({ field: 'orderIndex', message: 'bad' }), form, ['title'], setFormError, GENERIC)

    expect(setError).not.toHaveBeenCalled()
    expect(setFormError).toHaveBeenCalledWith('Validation failed')
  })

  it('shows a 400 with no field errors at form level', () => {
    const { setFormError, form } = setup()

    showApiError(new ApiError(400, 'Malformed body'), form, ['title'], setFormError, GENERIC)

    expect(setFormError).toHaveBeenCalledWith('Malformed body')
  })

  it('places only the fields that belong to the form, ignoring the rest', () => {
    const { setError, setFormError, form } = setup()

    showApiError(
      validation({ field: 'orderIndex', message: 'bad' }, { field: 'title', message: 'too long' }),
      form,
      ['title'],
      setFormError,
      GENERIC,
    )

    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith('title', { type: 'server', message: 'too long' })
    expect(setFormError).not.toHaveBeenCalled()
  })

  it('uses the ApiError message when the server could not be reached', () => {
    const { setFormError, form } = setup()

    showApiError(new ApiError(0, 'Could not reach the server.'), form, ['title'], setFormError, GENERIC)

    expect(setFormError).toHaveBeenCalledWith('Could not reach the server.')
  })

  it.each([
    ['a 5xx', new ApiError(500, 'internal detail')],
    ['a 409', new ApiError(409, 'conflict detail')],
    ['a non-API error', new TypeError('x is undefined')],
    ['a thrown string', 'oops'],
  ])('uses the generic message for %s, never leaking its text', (_label, error) => {
    const { setError, setFormError, form } = setup()

    showApiError(error, form, ['title'], setFormError, GENERIC)

    expect(setFormError).toHaveBeenCalledWith(GENERIC)
    expect(setError).not.toHaveBeenCalled()
  })
})
