import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest has no globals here, so Testing Library's automatic cleanup isn't registered for us.
afterEach(() => {
  cleanup()
})
