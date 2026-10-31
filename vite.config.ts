import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cloudflare } from '@cloudflare/vite-plugin'

// Test config lives in vitest.config.ts — the cloudflare() plugin here
// starts its own dev server, which collides with Vitest's.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' + injectRegister: false: we register the service worker
      // ourselves via the React hook (UpdateToast) so a new version waits
      // for the user to tap "Refresh" instead of silently hot-swapping
      // underneath them. Paired with a periodic update check, since relying
      // on "the next navigation happens to notice" is what caused the
      // repeated stale-cache confusion while testing this app.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Parsely',
        short_name: 'Parsely',
        description: 'Household budget & spend tracker',
        theme_color: '#15803d',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    cloudflare(),
  ],
})
