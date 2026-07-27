import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Lets `vite dev` run the service worker too, so offline/install
      // behavior can be checked without a production build.
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Roster Lock',
        short_name: 'Roster Lock',
        description: 'Browser PWA game client for roster-lock',
        start_url: '.',
        display: 'standalone',
        background_color: '#1e293b',
        theme_color: '#1e293b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // The default glob (js,css,html,ico,png,svg) misses .mp3, so the
      // select-bongo sound wouldn't get precached without this.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'],
        // Default limit is 2 MiB; the single unsplit JS bundle is ~4.3 MB.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 5180,
  },
  // These are workspace packages (pnpm symlinks), which Vite otherwise
  // treats as source rather than optimizable deps and serves straight from
  // their CommonJS dist/ build via /@fs/ - native <script type="module">
  // can't consume that directly. Forcing them through the dependency
  // optimizer gives them a real CJS->ESM interop shim.
  optimizeDeps: {
    include: [
      "@roster-lock/ts-client",
      "@roster-lock/types",
      "@roster-lock/utils",
      "@roster-lock/example-game-engine",
    ],
  },
  // `vite build` uses Rollup directly (no dep-optimizer step), and Rollup's
  // commonjs plugin only auto-transforms paths under node_modules. These
  // workspace packages resolve (via pnpm symlinks) to real paths outside
  // node_modules, so without this they're passed through as raw CJS
  // (require/exports) instead of being converted to ESM, and named imports
  // from them fail to resolve at build time.
  build: {
    commonjsOptions: {
      include: [/client\/typescript/, /core\/types/, /core\/utils/, /game-engine/, /node_modules/],
    },
  },
});
