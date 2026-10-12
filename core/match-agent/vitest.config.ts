import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    // client/ (match-agent-client) is its own package with its own test
    // tooling (tsc/vite, and Playwright specs under client/e2e) - vitest's
    // default excludes don't know to skip a nested package's own test
    // files, so without this, running `pnpm test` here also tries (and
    // fails) to execute client/e2e's Playwright specs as vitest tests.
    exclude: [...configDefaults.exclude, 'client/**'],
  }
});
