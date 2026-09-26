import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_NAME, useDocumentTitle } from './useDocumentTitle'

afterEach(() => {
  document.title = ''
})

describe('useDocumentTitle', () => {
  it('names the tab after the page', () => {
    renderHook(() => useDocumentTitle('Dashboard'))
    expect(document.title).toBe(`Dashboard · ${APP_NAME}`)
  })

  it('shows just the app name while the page name is unknown', () => {
    renderHook(() => useDocumentTitle(undefined))
    expect(document.title).toBe(APP_NAME)
  })

  it('follows the page name as it changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: undefined as string | undefined },
    })
    rerender({ title: 'Graphs' })
    expect(document.title).toBe(`Graphs · ${APP_NAME}`)
  })

  it('puts the app name back when the page goes away', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Courses'))
    unmount()
    expect(document.title).toBe(APP_NAME)
  })
})
