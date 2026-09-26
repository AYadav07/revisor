import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Must run before any module that defines a Zod schema — see the file.
import './lib/zodConfig'
import './index.css'
import App from './App.tsx'
import { createQueryClient } from './lib/queryClient'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Writes data-theme="light"|"dark" on <html>, persisted in localStorage and defaulting to the
        OS preference (UI_DESIGN.md §2). The toggle itself arrives with the AppShell's user menu. */}
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
