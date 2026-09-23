import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest has no globals here, so Testing Library's automatic cleanup isn't registered for us.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia, which Sonner (theme detection) and other UI code probe.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
