---
phase: 02-tests-quality-infrastructure
plan: "02"
subsystem: tests
tags: [vitest, unit-tests, zod, settings, tdd]

requires:
  - "02-01 (Vitest + tests/ scaffolding)"
provides:
  - "berrygems/tests/lib/ fully populated — 12 unit test files, 70 passing tests"
  - "berrygems/lib/settings.ts has a Zod safeParse layer on the pantry.* forward branch"
  - "Forward contract: malformed pantry.* settings fall back to default without throwing (D-10)"
affects:
  - 02-tests-quality-infrastructure
  - 03+

tech-stack:
  added:
    - "zod@^4.3.6 (direct dependency of berrygems)"
  patterns:
    - "Real-fs tests via os.tmpdir() + HOME env shim — no fs/DB mocks per .claude/rules/testing.md"
    - "D-07 top-of-file block comment: every lib test declares what's covered (pure + fs) and what's explicitly deferred to TEST-03 integration"
    - "Zod safeParse + fall-through (never throw) — tolerant forward schema, legacy branch untouched"

key-files:
  created:
    - berrygems/tests/lib/globals.test.ts
    - berrygems/tests/lib/settings.test.ts
    - berrygems/tests/lib/cooldown.test.ts
    - berrygems/tests/lib/id.test.ts
    - berrygems/tests/lib/compaction-templates.test.ts
    - berrygems/tests/lib/panel-chrome.test.ts
    - berrygems/tests/lib/animated-image.test.ts
    - berrygems/tests/lib/animated-image-player.test.ts
    - berrygems/tests/lib/giphy-source.test.ts
    - berrygems/tests/lib/lsp-client.test.ts
    - berrygems/tests/lib/pi-spawn.test.ts
    - berrygems/tests/lib/sse-client.test.ts
  modified:
    - berrygems/lib/settings.ts
    - berrygems/package.json
    - berrygems/pnpm-lock.yaml

key-decisions:
  - "On Zod safeParse failure, skip the forward pantry.* branch entirely and fall through to legacy + fallback — satisfies D-10 ('malformed must not brick pantry load') and matches the test contract ('schema mismatch returns fallback'). The plan's <interfaces> code sketch showed raw-object-on-failure, but the stated test expectation is fallback-on-failure; the stated test expectation wins."
  - "zod was promoted from implicit transitive dep (via pantry root devDependency) to an explicit berrygems/package.json dependency so the lib can be consumed outside the workspace."
  - "Each lib test declares its D-07 bounds in a top-of-file block comment so future readers know what's unit-tested vs what waits for TEST-03 extension integration."

patterns-established:
  - "tests/lib/<name>.test.ts mirrors lib/<name>.ts 1:1 — every lib module has a matching test file"
  - "external-surface modules (giphy/lsp/pi-spawn/sse/animated-image*) expose narrow pure helpers that are unit-tested; their heavy I/O is deferred to TEST-03"

requirements-completed: [TEST-02]

duration: 45min
completed: 2026-04-23
---

# Phase 02 Plan 02: Lib Unit Tests + Settings Zod Layer Summary

**Populates berrygems/tests/lib/ with 12 test files (70 passing tests) and lands a tolerant Zod safeParse layer on readPantrySetting's forward branch. Closes TEST-02.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 4
- **Files created:** 12 test files + 1 summary
- **Files modified:** 3 (settings.ts, package.json, pnpm-lock.yaml)

## Accomplishments

- `berrygems/tests/lib/` now holds 12 test files matching 1:1 with the 12 modules in `berrygems/lib/`.
- `pnpm --dir berrygems test` → 12 files, 70 tests, all passing, ~240ms.
- `pnpm --dir berrygems exec tsc --project tsconfig.tests.json` → clean.
- `berrygems/lib/settings.ts` gained `PantrySettingsSchema` (Zod, optional + passthrough) and a `safeParse` wrapper on the `pantry.*` forward branch. Legacy `dotsPiEnhancements.*` path is untouched.
- D-10 honored: malformed settings (bad JSON, wrong-typed values) return fallback, never throw.
- Zero fs/network mocks — real `os.tmpdir()` + `process.env.HOME` shim in `settings.test.ts`.

## Per-Module Coverage Notes

- **globals.test.ts** — full: PANTRY_KEYS shape + registerGlobal/getGlobal round-trip + undefined-on-unknown.
- **settings.test.ts** — full fs surface: forward reads, malformed JSON, legacy fallback, Zod mismatch fallback, missing file.
- **cooldown.test.ts** — full: isActive/set/setUntil/clear/clearAll/activeKeys timestamp math.
- **id.test.ts** — full: uuid shape, uniqueness, short-id hex, prefixed-id layout.
- **compaction-templates.test.ts** — full: preset catalog, template headings, prompt builders embed inputs correctly.
- **panel-chrome.test.ts** — pure helpers only: `repeatPattern` math, SKINS registry shape, `getSkin`/`setDefaultSkin`/`listSkins`. Rendering functions (`renderHeader`/`renderBorder`/`padContentLine`/`wrapInChrome`) need a live pi Theme and are deferred to TEST-03.
- **animated-image.test.ts** — pure helpers only: size registry + resolver, `allocateImageId` wrap-around (1..200), `buildPlaceholderLines` 256-color vs 24-bit fg encoding, constant relationships. Kitty stdout emission (`transmitFrame`, `deleteKittyImage`) and pi-tui cell IOCTL (`calculateImageCells`) deferred.
- **animated-image-player.test.ts** — state machinery only: ctor defaults, `setSpeed` clamping, `frameCount`, `isAnimated`, `advance/retreat` wrap, `seekTo` clamp. setInterval-driven auto-advance loop + stdout side-effects (`play`/`step`/`transmit`/`dispose`) deferred.
- **giphy-source.test.ts** — fallback table + query lookup + cache-clear smoke. Live `fetch`, ImageMagick spawn, AI vibe query (ExtensionContext-dependent) deferred.
- **lsp-client.test.ts** — `languageIdForFile` extension→id mapping + LspClient pre-start getters + dispose-without-start smoke. `spawn`, JSON-RPC framing I/O, and diagnostic stream deferred.
- **pi-spawn.test.ts** — `parseSpawnOutput` NDJSON parser (empty, message_end, response, raw lines, last-write-wins) + `findPiBinary` shape. `spawnPi` child_process path + timeout/abort wiring + temp-file prompt injection deferred.
- **sse-client.test.ts** — `connectSSE` handle shape + idempotent close() on unreachable endpoint. Live HTTP stream + reconnect backoff + internal data-line parser deferred (parser is inlined inside `res.on` and not individually exported).

## Task Commits

1. **Task 1: globals.test.ts reference pattern (D-08)** — `1b35c07` (test)
2. **Tasks 2+3: settings Zod safeParse + settings.test.ts** — `7995472` (feat)
3. **Task 4: the remaining 10 lib test files** — `3ace8cc` (test)

## Decisions Made

1. **Malformed → fallback, not malformed → raw value.** The plan's `<interfaces>` wrapper sketch preserved the raw object on safeParse failure, but the explicit test contract in Task 2 ("malformed returns fallback") is what users will rely on. On safeParse failure we now skip the forward branch entirely and fall through to legacy + fallback. This also better honors D-10's "must not brick pantry load" spirit — a malformed typed value can't silently pass through as the wrong runtime type.
2. **zod promoted to direct berrygems dep.** pnpm resolved it transitively through the root `pantry` package, but the berrygems extension is meant to be portable — pinning zod directly documents the real dependency.
3. **Thin tests are flagged, not hidden.** `sse-client.test.ts` is intentionally minimal (one test) because the SSE parser is inlined inside a closure and not individually exported. The top-of-file comment documents this explicitly so future readers know the coverage gap is known, not neglected.

## Deviations from Plan

- Combined Tasks 2 + 3 into a single `feat(02)` commit (settings.ts Zod layer + settings.test.ts together) — this was listed as acceptable in the plan's `<output>` block.
- Adjusted the Zod wrapper's failure behavior from "use raw object anyway" (the plan's `<interfaces>` sketch) to "skip forward branch, fall through to legacy + fallback" so the Task-2 malformed-schema test actually passes. Noted under Decisions Made §1.

## Issues Encountered

- `pnpm install` from the repo root didn't link zod into `berrygems/node_modules` — needed to run `pnpm install` from inside `berrygems/` to materialize the symlink. Not a bug, just pnpm workspace semantics.

## User Setup Required

None.

## Threat Surface

No new surface. The Zod layer is a defense (tolerates malformed input, falls back to safe default) over an already-privileged settings reader — strictly improves posture. No new attack vectors introduced.

## Next Phase Readiness

- TEST-02 closed. Next SC in phase 02 (per ROADMAP §2 SC #3) can proceed.
- The D-07 documentation pattern established by these 12 files sets the contract for TEST-03 (extension integration tests) — each extension test should note which deferred lib paths it exercises.

---

_Phase: 02-tests-quality-infrastructure_
_Completed: 2026-04-23_

## Self-Check: PASSED

- FOUND: 12 files under berrygems/tests/lib/_.test.ts (matches `ls berrygems/lib/_.ts | wc -l`).
- FOUND: `pnpm --dir berrygems test` → 12 files, 70 tests passed, exit 0.
- FOUND: `pnpm --dir berrygems exec tsc --project tsconfig.tests.json` → exit 0, no errors.
- FOUND: `rg 'vi\.mock|vitest\.mock' berrygems/tests/lib/` → 0 matches.
- FOUND: `rg '^import \{ z \} from "zod"' berrygems/lib/settings.ts` → 1 match.
- FOUND: `rg 'PantrySettingsSchema|safeParse' berrygems/lib/settings.ts` → schema definition + usage present.
- FOUND: Every test file opens with the D-07 top-of-file block comment ("Unit tests for berrygems/lib/...").
- FOUND: commits 1b35c07, 7995472, 3ace8cc.
