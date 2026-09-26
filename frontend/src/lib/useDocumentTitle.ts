import { useEffect } from 'react'

export const APP_NAME = 'Revisor'

/**
 * Names the browser tab after the page ("Dashboard · Revisor"), so tabs and history entries are
 * told apart. Pass undefined while the name isn't known yet (e.g. a course still loading) to show
 * just the app name. Leaving the page puts the plain app name back.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
