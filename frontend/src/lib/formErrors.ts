import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiError } from '@/api'

/**
 * Shows a failed create/update on the right part of a form. The server stays the authority on
 * validation, so its 400 messages are put against the fields they name; anything else is an
 * error for the form as a whole.
 *
 * @param fields  the form's own field names — a 400 about a field not on the form is shown
 *                at form level, since the user can't fix it there
 * @param setFormError  receives the form-level message
 * @param genericMessage  shown for errors the user can't act on (a 5xx, an unexpected failure)
 */
export function showApiError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  fields: readonly Path<T>[],
  setFormError: (message: string) => void,
  genericMessage: string,
): void {
  if (error instanceof ApiError && error.status === 400) {
    let placedOnAField = false
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if ((fields as readonly string[]).includes(field)) {
        form.setError(field as Path<T>, { type: 'server', message })
        placedOnAField = true
      }
    }
    if (!placedOnAField) setFormError(error.message)
    return
  }
  // An unreachable server's message already says so; anything else gets the generic wording.
  setFormError(error instanceof ApiError && error.status === 0 ? error.message : genericMessage)
}
