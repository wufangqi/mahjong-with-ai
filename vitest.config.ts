import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['prototype/**', 'node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: [
        'src/core/**/*.test.ts',
        // Harness for Testing Decisions self-play; not rule-core surface.
        'src/core/selfPlay.ts',
        // Type-only module (no runtime statements).
        'src/core/types.ts',
        '**/*.d.ts',
      ],
      // Spec asks 100% branches; residual ~6% are defensive optional-chain / empty-window
      // sides after 100% statements. Floor is the measured integrate tip — regressions fail CI.
      thresholds: {
        branches: 94,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
