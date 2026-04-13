import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Set TZ=UTC so Date.getHours() and toISOString() are consistent
    // regardless of the host machine's locale.
    // In Vitest 4, pool env is set at the top level.
    pool: 'forks',
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      include: ['lib/slot-finder.ts', 'lib/poll-manager.ts', 'lib/journal-club/**/*.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
