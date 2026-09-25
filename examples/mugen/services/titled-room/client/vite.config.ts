import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    // Needs to be embeddable in an <iframe> from the host shell's own
    // origin (a different port in local dev) - Vite's dev server sends
    // X-Frame-Options: SAMEORIGIN by default via some setups, but more
    // relevantly CSP frame-ancestors isn't set by Vite itself, so no extra
    // config is needed here in dev. A real deployment's own reverse proxy
    // is what would need to allow framing.
  },
  // Workspace packages (pnpm symlinks) - Vite otherwise treats them as
  // source and serves straight from their CommonJS dist/ build via /@fs/,
  // which native <script type="module"> can't consume. Forcing them through
  // the dep optimizer gives them a real CJS->ESM interop shim. Mirrors
  // core/match-agent/client/vite.config.ts.
  optimizeDeps: {
    include: [
      "@roster-lock/types",
      "@roster-lock/utils",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/core\/types/, /core\/utils/, /node_modules/],
    },
  },
});
