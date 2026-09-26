import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { cloudflarePages } from './scripts/cloudflarePages.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // VITE_API_URL may come from a .env file or the environment; CF_PAGES only from the environment.
  plugins: [
    react(),
    tailwindcss(),
    cloudflarePages({ CF_PAGES: process.env.CF_PAGES, VITE_API_URL: loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
}))
