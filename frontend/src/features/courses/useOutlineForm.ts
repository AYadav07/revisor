import { zodResolver } from '@hookform/resolvers/zod'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError, type CourseTree } from '@/api'
import { bulkAddSchema, type OutlineFormValues } from './courseSchemas'
import { lineForField, parseOutline, previewOutline, type OutlineError, type ParsedOutline } from './outline'
import { focusLine } from './OutlineWorkspace'

interface OutlineFormOptions {
  schema: typeof bulkAddSchema
  /** The course being added to; null when importing a new one. */
  course: CourseTree | null
  /** Whether the page has a course title field (import does; bulk add does not). */
  withTitle: boolean
  genericError: string
}

/**
 * State shared by the import and bulk-add pages: the form, the outline parsed as the user types,
 * its preview against `course` (null for a new course), and errors — the parser's, or the
 * server's mapped back onto outline lines.
 */
export function useOutlineForm({ schema, course, withTitle, genericError }: OutlineFormOptions) {
  const form = useForm<OutlineFormValues>({ resolver: zodResolver(schema), defaultValues: { title: '', outline: '' } })
  const text = form.watch('outline')
  // Parsing is cheap, but deferring keeps typing smooth in a long outline.
  const deferredText = useDeferredValue(text)
  const parsed = useMemo(() => parseOutline(deferredText), [deferredText])
  const preview = useMemo(() => previewOutline(parsed, course), [parsed, course])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // Server errors describe the text that was sent; once it is edited they no longer apply.
  const [serverErrors, setServerErrors] = useState<{ text: string; errors: OutlineError[] } | null>(null)

  const errors = parsed.errors.length > 0 ? parsed.errors : serverErrors?.text === text ? serverErrors.errors : []

  /** The outline as it is right now (not the deferred one), or null when it can't be saved. */
  function current(): ParsedOutline | null {
    const latest = parseOutline(form.getValues('outline'))
    return latest.errors.length === 0 && latest.topics.length > 0 ? latest : null
  }

  function showServerError(error: unknown, submitted: ParsedOutline, submittedText: string) {
    if (!(error instanceof ApiError && error.status === 400)) {
      setFormError(error instanceof ApiError && error.status === 0 ? error.message : genericError)
      return
    }
    const lineErrors: OutlineError[] = []
    const unplaced: string[] = []
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      const line = field === 'title' ? null : lineForField(submitted, field)
      if (field === 'title' && withTitle) {
        form.setError('title', { type: 'server', message })
      } else if (line !== null) {
        lineErrors.push({ line, message })
      } else {
        unplaced.push(message)
      }
    }
    setServerErrors({ text: submittedText, errors: lineErrors.sort((a, b) => a.line - b.line) })
    if (unplaced.length > 0 || Object.keys(error.fieldErrors).length === 0) {
      setFormError(unplaced.length > 0 ? unplaced.join(' ') : error.message)
    }
  }

  return {
    form,
    text,
    parsed,
    preview,
    errors,
    textareaRef,
    formError,
    setFormError,
    showServerError,
    current,
    /** False while there are errors, nothing to add, or the preview lags behind the text. */
    canSave: parsed.errors.length === 0 && parsed.topics.length > 0 && deferredText === text,
    selectLine: (line: number) => focusLine(textareaRef.current, line),
    insertExample: (example: string) => form.setValue('outline', example, { shouldDirty: true }),
  }
}
