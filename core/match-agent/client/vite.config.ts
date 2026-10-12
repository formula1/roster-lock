import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5182,
  },
  // Workspace packages (pnpm symlinks) - Vite otherwise treats them as
  // source and serves straight from their CommonJS dist/ build via /@fs/,
  // which native <script type="module"> can't consume. Forcing them through
  // the dep optimizer gives them a real CJS->ESM interop shim. Mirrors
  // examples/full-local/game/game-pwa/vite.config.ts, the other consumer of
  // @roster-lock/ts-client.
  optimizeDeps: {
    include: [
      "@roster-lock/ts-client",
      "@roster-lock/types",
      "@roster-lock/utils",
    ],
  },
  // `vite build` uses Rollup directly (no dep-optimizer step), and Rollup's
  // commonjs plugin only auto-transforms paths under node_modules. These
  // workspace packages resolve (via pnpm symlinks) to real paths outside
  // node_modules, so without this they're passed through as raw CJS instead
  // of being converted to ESM, and named imports from them fail to resolve
  // at build time.
  build: {
    commonjsOptions: {
      include: [/client\/typescript/, /core\/types/, /core\/utils/, /node_modules/],
    },
  },
});
