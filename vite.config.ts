import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // En GitHub Pages la app vive en /<nombre-del-repo>/, así que se puede ajustar con BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // Convierte la web en una app instalable que funciona sin internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Seguimiento Fit',
        short_name: 'Fit',
        description: 'Seguimiento personal de alimentación y entrenamiento',
        lang: 'es',
        theme_color: '#2f8f5b',
        background_color: '#f6f7f5',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
