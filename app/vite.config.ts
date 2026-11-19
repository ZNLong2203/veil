import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // An App Check debug token is a bypass credential: it must never end up in a production bundle,
  // whatever is in .env.local.
  define: mode === 'production' ? { 'import.meta.env.VITE_APPCHECK_DEBUG_TOKEN': '""' } : {},
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}))
