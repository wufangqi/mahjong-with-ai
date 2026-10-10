import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['prototype/**', 'node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        'prototype/**',
        'node_modules/**',
        'dist/**',
        'e2e/**',
        '**/*.d.ts',
        'src/preview/scene.ts',
        'src/preview/tiles.ts',
        'src/preview/fx.ts',
        'src/preview/audio.ts',
        'src/preview/court.ts',
      ],
    },
  },
});
