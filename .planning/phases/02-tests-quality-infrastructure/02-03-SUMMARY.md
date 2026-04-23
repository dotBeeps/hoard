---
phase: 02-tests-quality-infrastructure
plan: 03
status: complete
requirements: [TEST-03]
self_check: PASSED
---

# 02-03 Summary — dragon-guard integration spike

## What was built

TEST-03 research-flag spike per ROADMAP §Research Flags Carried Forward — an
integration test for the richest directory extension (`dragon-guard`) before
fanning out to the other 16 extensions in 02-04.

- `berrygems/tests/helpers/createPiTestSession.ts` — thin re-export of
  `@marcfargas/pi-test-harness` `createTestSession`. Case A (no harness gap
  found). Gives the fanout plan a stable import path.
- `berrygems/tests/extensions/dragon-guard.test.ts` — 4 passing integration
  tests asserting the D-04 SC-minimum bar.

## Key files created

| File                                              | Purpose                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `berrygems/tests/helpers/createPiTestSession.ts`  | Stable import path for fanout; thin re-export.                                       |
| `berrygems/tests/extensions/dragon-guard.test.ts` | TEST-03 spike — dragon-guard load + 8 commands + 0 tools + consumer-only assertions. |

## Harness capability findings (CRITICAL — 02-04 consumes this verbatim)

The harness (`@marcfargas/pi-test-harness@0.5.0`) covers the D-04 SC-minimum
bar for dragon-guard **without any wrapping**. Key findings:

- **`options.extensions`** takes **absolute file paths** (or paths relative to
  `cwd`), not extension names. `session.js:35` resolves each path via
  `path.resolve(cwd, p)`. Pass the absolute path to the extension's `index.ts`.
- **`session.session`** is the real pi `AgentSession`. Introspection surface:
  - `session.session.extensionRunner.getRegisteredCommands()` →
    `ResolvedCommand[]` with `{ name, description?, source, sourceInfo, ... }`.
    This is how we assert commands are registered.
  - `session.session.extensionRunner.getAllRegisteredTools()` →
    `RegisteredTool[]`. Empty for dragon-guard (0 tools).
  - `session.session.agent.state.tools` — also available but `getAllRegisteredTools()`
    is the semantic accessor.
- **Cleanup:** `session.dispose()` (NOT `session.close()` — the planner's
  skeleton used `.close()` which does not exist; fanout must use `.dispose()`).
  Dispose cleans up the auto-created temp cwd.
- **ES module gotcha:** test files run as ES modules (no `__dirname`). Use
  `path.dirname(fileURLToPath(import.meta.url))` to resolve absolute paths.
- **Extension load errors** are thrown by `createTestSession` — a failed load
  makes the test fail at the `await createTestSession(...)` call itself, which
  is exactly the D-04 bar #1 ("loads without error") assertion. No extra
  guard needed.
- **`createMockPi`** is available if an extension spawns pi as a subprocess,
  but dragon-guard does not, so it is unused here.

### Harness gaps

**None found for dragon-guard.** The ROADMAP research-flag items
(`resources_discover`, `session_before_compact`, context-event mutation) are
not exercised by dragon-guard, so the spike cannot confirm or deny coverage
for those surfaces. Fanout (02-04) may surface additional gaps per extension;
the escape hatch per D-02 is: **document the gap and skip the specific
assertion, never hand-roll a second harness**.

## Dragon-guard live surface (verified)

- `registerTool`: **0** matches (confirmed: `rg 'pi\.registerTool\(' berrygems/extensions/dragon-guard/` returns empty).
- `registerCommand`: **8** matches at `berrygems/extensions/dragon-guard/index.ts:531,539,544,549,554,559,564,572` — `mode`, `dragon`, `puppy`, `plan`, `nomode`, `dog`, `guard-settings`, `guard`. Matches planner snapshot.
- `registerGlobal`: **0** matches — dragon-guard does NOT publish.
- `getGlobal(PANTRY_KEYS.*)`: **2** matches, both `parchment` (panel.ts:55, index.ts:57). Dragon-guard is a CONSUMER of `pantry.parchment`.

## Pattern for 02-04 fanout (copy-paste-adapt per extension)

```typescript
/**
 * Integration test for berrygems/extensions/<NAME>/
 *
 * Uses @marcfargas/pi-test-harness createTestSession — NO direct imports from
 * ../../extensions/<NAME> (SC #5 grep gate).
 *
 * Asserts: loads without error; every registered tool/command present;
 *   publication status (either asserted or explicitly documented N/A).
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createTestSession } from "../helpers/createPiTestSession.ts";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(THIS_DIR, "../../extensions/<NAME>/index.ts");

const EXPECTED_COMMANDS: string[] = [
  /* names from rg 'pi\.registerCommand\(' */
];
const EXPECTED_TOOLS: string[] = [
  /* names from rg 'pi\.registerTool\(' */
];

describe("extension: <NAME>", () => {
  it("loads via createTestSession without error", async () => {
    const session = await createTestSession({ extensions: [EXT_PATH] });
    expect(session).toBeDefined();
    session.dispose();
  });

  it("registers its commands", async () => {
    const session = await createTestSession({ extensions: [EXT_PATH] });
    try {
      const commands = session.session.extensionRunner.getRegisteredCommands();
      const names = commands.map((c: { name: string }) => c.name);
      expect(names).toEqual(expect.arrayContaining(EXPECTED_COMMANDS));
    } finally {
      session.dispose();
    }
  });

  it("registers its tools", async () => {
    const session = await createTestSession({ extensions: [EXT_PATH] });
    try {
      const tools = session.session.extensionRunner.getAllRegisteredTools();
      const names = tools.map(
        (t: { definition: { name: string } }) => t.definition.name,
      );
      expect(names).toEqual(expect.arrayContaining(EXPECTED_TOOLS));
    } finally {
      session.dispose();
    }
  });

  // If the extension publishes via registerGlobal(PANTRY_KEYS.X), add:
  //   it("publishes Symbol.for('pantry.X')", async () => {
  //     const session = await createTestSession({ extensions: [EXT_PATH] });
  //     try {
  //       expect(getGlobal(PANTRY_KEYS.X)).toBeDefined();
  //     } finally { session.dispose(); }
  //   });
  // Else, document "does not publish — consumer-only" in top-of-file comment.
});
```

**Adaptation checklist per extension:**

1. Inventory with `rg -n 'pi\.registerTool\(' berrygems/extensions/<NAME>/` and `rg -n 'pi\.registerCommand\(' berrygems/extensions/<NAME>/`.
2. Check publication with `rg -n 'registerGlobal\(' berrygems/extensions/<NAME>/`. If zero → consumer-only comment. If >0 → assert the publication.
3. If the extension has **zero commands** or **zero tools**, drop those `it` blocks (or keep as `expect(...).toEqual([])` sanity checks — dragon-guard keeps the zero-tools check as defensive documentation).
4. If an extension load errors — surface the error, do not paper over. That is the D-04 bar #1 signal.

## Research Flag discharge

ROADMAP §"Research Flags Carried Forward" — **"Budget a spike on `dragon-guard`
(richest directory extension) before fanning out across 17 extensions"** — is
**DISCHARGED** by this plan. The pattern above is what fanout (02-04) copies.

## Self-Check: PASSED

1. `ls berrygems/tests/extensions/dragon-guard.test.ts` — exists.
2. `ls berrygems/tests/helpers/createPiTestSession.ts` — exists.
3. `pnpm --dir berrygems exec tsc --project tsconfig.tests.json --noEmit` — exit 0.
4. `pnpm --dir berrygems test` — exit 0, **74 tests passing** (70 lib from 02-02 + 4 dragon-guard).
5. `rg 'from "\.\./\.\./?extensions/' berrygems/tests/**/*.test.ts` — 0 matches (SC #5 honored).
6. Dragon-guard test asserts: session loads; 8 commands registered; 0 tools registered; does-not-publish documented.

## Commits

1. `test(02): add tests/helpers/createPiTestSession.ts thin re-export`
2. `test(02): dragon-guard integration spike — harness pattern established`
3. `docs(02-03): add spike summary with harness findings` (this file)
