import { defineConfig } from "vitest/config";

/**
 * Smoke-only Vitest config — runs tests/smoke/** exclusively.
 *
 * Separate from the main vitest.config.ts on purpose (D-17): the default
 * `pnpm --dir berrygems test` invocation must NOT collect the smoke file
 * because `verifySandboxInstall` runs `npm pack` + install and takes 10-90s.
 * Smoke is only reached via `pnpm --dir berrygems test:smoke`, which passes
 * `--config vitest.smoke.config.ts` to this file.
 */
export default defineConfig({
  test: {
    include: ["tests/smoke/**/*.test.ts"],
    experimental: {
      viteModuleRunner: false,
    },
    globals: false,
    passWithNoTests: false,
  },
});
