import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globalSetup: './plugin/protocol/globalSetup.ts',
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
