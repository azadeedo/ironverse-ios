import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// ---- real version info baked into every build (and published as /version.json) ----
const PKG = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
const GIT = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() } catch { return 'nogit' } })()
const RELEASED = new Date().toISOString()
const BUILD_ID = `${PKG.version}+${GIT}.${RELEASED.replace(/[-:TZ.]/g, '').slice(0, 12)}`
const versionManifest = () => ({
  name: 'iv-version-manifest',
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ app: 'Ironverse', version: PKG.version, build: BUILD_ID, commit: GIT, released: RELEASED }, null, 2) })
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(PKG.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __RELEASE_DATE__: JSON.stringify(RELEASED),
  },
  plugins: [
    react(),
    versionManifest(),
    VitePWA({
      // 'prompt': a new version waits for his OK instead of reloading mid-workout
      registerType: 'prompt',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      workbox: {
        importScripts: ['sw-bridge.js'],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,mjs}'],
        // exercise demonstration images are cached the first time they are viewed,
        // not all up-front — keeps installs and updates small
        globIgnores: ['**/media/**', 'version.json', '**/Anatomy3DScreen-*.js', '**/Body3D-*.js', '**/three*.js', '**/OrbitControls-*.js'],
        runtimeCaching: [
          // the 3D body (three.js, ~500 KB) is cached the first time it is opened, not in every update
          { urlPattern: /\/assets\/(Anatomy3DScreen|Body3D|three|OrbitControls)[^/]*\.js$/, handler: 'CacheFirst', options: { cacheName: 'iv-3d', expiration: { maxEntries: 8 } } },
          { urlPattern: /\/media\/iv-body\.bin$/, handler: 'CacheFirst', options: { cacheName: 'iv-body', expiration: { maxEntries: 2 } } },{
          urlPattern: /\/media\/(exercises|brand)\/.*\.webp$/,
          handler: 'CacheFirst',
          options: { cacheName: 'exercise-media', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180 } },
        }],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Ironverse',
        short_name: 'Ironverse',
        description: 'Personal home-gym coach: workouts, nutrition, hydration, progress',
        theme_color: '#0c111c',
        background_color: '#0c111c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
})
