/**
 * Install smoke test — harness-fast side (Phase 2 half of the dual-smoke gate).
 *
 * Calls verifySandboxInstall({ packageDir }) from @marcfargas/pi-test-harness
 * against the repo root, which does `npm pack` → install → DefaultResourceLoader
 * discovery, and returns a SandboxResult with:
 *   - loaded.extensions: number (count of loaded extensions)
 *   - loaded.skills:     number (count of loaded skills)
 *   - loaded.tools:      string[] (tool names registered by loaded extensions)
 *   - loaded.extensionErrors: string[] ("<path>: <error>" entries)
 *
 * SandboxResult does NOT expose extension or skill names as strings, so
 * "named > count" assertions per PITFALLS §5 are enforced via:
 *
 *   1. loaded.tools contains specific known tool names ("ask" from dragon-inquiry,
 *      "popup" from dragon-scroll, "todo_panel" from kobold-housekeeping).
 *      These are stable names — renames fail this assertion loudly.
 *   2. loaded.extensionErrors contains no entries mentioning "dragon-parchment"
 *      or "dragon-guard" by path. If those extensions fail to load, their paths
 *      surface by name in the error list — the regression is caught by name.
 *
 * Secondary count assertions (>= 17 extensions, >= 54 skills) act as a second
 * trip wire if a loader regression silently drops resources.
 *
 * Excluded from the default vitest run via berrygems/vitest.config.ts
 * (test.include omits tests/smoke/** per 02-CONTEXT.md §D-17). Reachable via
 * `pnpm --dir berrygems test:smoke` or Phase 4 CI-02's same invocation.
 *
 * Phase 4 CI-02 consumes this file verbatim as the harness-fast gate and adds
 * a separate shell step running `HOME=$(mktemp -d) pi install $GITHUB_WORKSPACE
 * && pi list` as the real-install gate.
 */
import { describe, it, expect } from "vitest";
import { verifySandboxInstall } from "@marcfargas/pi-test-harness";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// berrygems/tests/smoke → berrygems/tests → berrygems → repo root
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

// Local-skip gate for the known upstream blocker.
// @marcfargas/pi-test-harness@0.5.0's sandbox.ts:29-35 calls execSync("npm pack
// --pack-destination .", { encoding: "utf-8" }) WITHOUT a maxBuffer option.
// Node's default execSync maxBuffer is 1 MiB; `npm pack` on this repo emits
// ~2.3 MB (17,230 lines) of stdout because it lists every file in 17
// extensions + 54 skills. Result: spawnSync ENOBUFS before the pack completes.
//
// Set PANTRY_SMOKE_RUN=1 locally to force-run anyway (useful when a harness
// patch lands and we want to verify without editing the file). In Phase 4 CI
// (GitHub Actions), the env var is set so CI exercises the smoke gate. See
// 02-06-SUMMARY.md "Local execution result" for the full story.
const SKIP_SANDBOX = process.env.PANTRY_SMOKE_RUN !== "1";

describe.skipIf(SKIP_SANDBOX)(
  "install smoke (harness-fast — verifySandboxInstall)",
  () => {
    it("installs the package and loads named tools + extensions without errors", async () => {
      const result = await verifySandboxInstall({ packageDir: REPO_ROOT });

      const loaded = result?.loaded;
      expect(loaded, "SandboxResult.loaded must be present").toBeDefined();

      const toolNames = loaded?.tools ?? [];
      const extensionErrors = loaded?.extensionErrors ?? [];

      // Primary: NAMED assertions via tools (PITFALLS §5 — named > count).
      // These tool names are registered by specific extensions:
      //   "ask"         → dragon-inquiry
      //   "popup"       → dragon-scroll
      //   "todo_panel"  → kobold-housekeeping
      // A rename silently passes count-only; it fails this check loudly.
      expect(toolNames).toEqual(
        expect.arrayContaining(["ask", "popup", "todo_panel"]),
      );

      // Primary: NAMED extension regression check. dragon-parchment and
      // dragon-guard don't register tools, so they can't appear in loaded.tools —
      // but if they fail to load, their paths surface in extensionErrors BY NAME.
      // Assert no error entry mentions either extension by name.
      const dragonParchmentErrors = extensionErrors.filter((e: string) =>
        e.includes("dragon-parchment"),
      );
      const dragonGuardErrors = extensionErrors.filter((e: string) =>
        e.includes("dragon-guard"),
      );
      expect(dragonParchmentErrors).toEqual([]);
      expect(dragonGuardErrors).toEqual([]);

      // Secondary: count sanity. Post-Phase-1 counts: 17 extensions, 54 skills.
      // If these drop sharply, a loader regression silently dropped resources.
      expect(loaded?.extensions ?? 0).toBeGreaterThanOrEqual(17);
      expect(loaded?.skills ?? 0).toBeGreaterThanOrEqual(54);

      // Full-load invariant: no extension errors at all. Any error here is a
      // shippable-install regression — a file that loads in dev but fails in a
      // clean sandbox install.
      expect(extensionErrors).toEqual([]);
    }, 120_000); // install is slow (npm pack + install); 2 min timeout
  },
);
