import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '弓木奈於 生写真管理',
        short_name: '生写真管理',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait', // 縦向き固定（撮影中・閲覧中に横回転しない）
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
