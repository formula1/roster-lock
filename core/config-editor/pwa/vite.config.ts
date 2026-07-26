import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // The gui package imports .md tooltip files as strings.
    {
      name: 'markdown-as-raw',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.md')) {
          return `export default ${JSON.stringify(code)}`
        }
      },
    },
  ],
  resolve: {
    // The gui package is consumed as source via workspace symlink - make
    // sure react resolves to a single copy so hooks/contexts stay shared.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  build: {
    commonjsOptions: {
      // shared/utils are commonjs workspace packages that resolve outside
      // node_modules (pnpm symlinks) - without this rollup treats them as
      // ESM and finds no named exports.
      include: [/node_modules/, /shared/, /utils/],
    },
  },
  optimizeDeps: {
    include: ['@roster-lock/shared', '@roster-lock/utils'],
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
