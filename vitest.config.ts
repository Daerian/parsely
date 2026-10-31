import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: the cloudflare() plugin used
// there for deploy/dev starts its own server, which collides with Vitest's.
// Our tests are plain TypeScript (no JSX/Tailwind/PWA), so no plugins needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
