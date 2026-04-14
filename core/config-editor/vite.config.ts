import { defineConfig, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig(async (): Promise<UserConfig>=>({
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      'path': require.resolve('path-browserify'),
      // magnet-uri only has "import" in exports, no "require" - point directly to the file
      'magnet-uri': require.resolve('@roster-lock/shared/node_modules/magnet-uri/index.js'),
    },
  },
  plugins: [
    react(),
    {
      name: 'markdown-as-raw',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.md')) {
          return `export default ${JSON.stringify(code)}`
        }
      },
    },
    ...(!process.env.ANALYZE ? [] : await Promise.resolve().then(async ()=>{
      const { visualizer } = await import("rollup-plugin-visualizer")
      return [
        visualizer({ open: true, filename: 'dist/stats.html', gzipSize: true, brotliSize: true })
      ]
    }))
  ],
  // Remove base for Tauri - it handles this automatically
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Optimize for Tauri
    target: 'esnext', // Tauri uses modern web standards
    rollupOptions: {
      // Ensure assets are properly handled
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
    commonjsOptions: {
      // Include the shared module for CommonJS transformation
      include: [/node_modules/, /shared/],
    },
    sourcemap: 'inline', // or just true for separate .map files
    minify: false, // optional: easier to read the compiled output
  },
  optimizeDeps: {
    // Force Vite to pre-bundle the shared module and polyfills
    include: ['@roster-lock/shared', 'path-browserify'],
    exclude: ['magnet-uri'],
  },
  server: {
    port: 5173,
    strictPort: true, // Don't try other ports if 5173 is busy
  },
}))
