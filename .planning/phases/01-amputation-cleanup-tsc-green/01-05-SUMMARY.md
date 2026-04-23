---
phase: 01-amputation-cleanup-tsc-green
plan: "05"
subsystem: berrygems
tags: [globals, typed-registry, pantry-keys, migration, tsc-green, amp-05]
dependency_graph:
  requires: [01-01, 01-04]
  provides: [PANTRY_KEYS, registerGlobal, getGlobal, typed-globalThis-registry]
  affects:
    [
      berrygems/lib/globals.ts,
      berrygems/extensions/dragon-parchment.ts,
      berrygems/extensions/kitty-gif-renderer.ts,
      berrygems/extensions/dragon-image-fetch.ts,
      berrygems/extensions/dragon-lab.ts,
      berrygems/extensions/dragon-breath/index.ts,
      berrygems/extensions/dragon-digestion.ts,
      berrygems/extensions/dragon-guard/index.ts,
      berrygems/extensions/dragon-guard/panel.ts,
      berrygems/extensions/dragon-inquiry.ts,
      berrygems/extensions/dragon-scroll.ts,
      berrygems/extensions/dragon-tongue.ts,
      berrygems/extensions/kobold-housekeeping.ts,
    ]
tech_stack:
  added: [berrygems/lib/globals.ts]
  patterns:
    [
      typed-globalThis-registry,
      as-unknown-as-Record-symbol-T,
      getGlobal-wrapper,
    ]
key_files:
  created: [berrygems/lib/globals.ts]
  modified:
    - berrygems/extensions/dragon-parchment.ts
    - berrygems/extensions/kitty-gif-renderer.ts
    - berrygems/extensions/dragon-image-fetch.ts
    - berrygems/extensions/dragon-lab.ts
    - berrygems/extensions/dragon-breath/index.ts
    - berrygems/extensions/dragon-digestion.ts
    - berrygems/extensions/dragon-guard/index.ts
    - berrygems/extensions/dragon-guard/panel.ts
    - berrygems/extensions/dragon-inquiry.ts
    - berrygems/extensions/dragon-scroll.ts
    - berrygems/extensions/dragon-tongue.ts
    - berrygems/extensions/kobold-housekeeping.ts
decisions:
  - "D-01/D-02: PANTRY_KEYS const + registerGlobal<T>/getGlobal<T> in berrygems/lib/globals.ts using as unknown as Record<symbol,T> (no as any)"
  - "D-03: All 22 call sites migrated; getPanels() wrappers retained as one-liners over getGlobal to avoid churn at call sites; comment added per no-any-without-comment policy"
  - "getGlobal with no type arg (returning unknown | undefined) used in wrapper bodies; tsc accepts unknown as assignable to any in return position"
  - "dragon-digestion.ts lab consumer: inline import('./dragon-lab').DragonLabAPI type retained as generic arg to getGlobal<T>"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-23T04:00:00Z"
  tasks_completed: 4
  files_changed: 13
---

# Phase 01 Plan 05: AMP-05 — Typed globalThis Registry Summary

**One-liner:** Centralized `PANTRY_KEYS` const + typed `registerGlobal<T>`/`getGlobal<T>` helpers in `berrygems/lib/globals.ts`, migrating all 22 `(globalThis as any)[Symbol.for("pantry.*")]` call sites across 13 extension files with zero `as any` remaining in extensions and tsc green.

## What Was Built

Created `berrygems/lib/globals.ts` — a new shared lib module exporting:

- `PANTRY_KEYS`: a `const` object with 5 `Symbol.for("pantry.*")` keys (parchment, kitty, breath, imageFetch, lab)
- `registerGlobal<T>(key: symbol, api: T): void` — typed publisher helper
- `getGlobal<T>(key: symbol): T | undefined` — typed consumer helper

Both helpers use `as unknown as Record<symbol, T>` (not `as any`) — the correct no-any-policy cast matching the `settings.ts` analog precedent.

Migrated all 22 call sites:

- **7 publisher sites** (5 files): `dragon-parchment.ts`, `kitty-gif-renderer.ts`, `dragon-image-fetch.ts`, `dragon-lab.ts`, `dragon-breath/index.ts`
- **15 consumer sites** (7 files): `dragon-digestion.ts`, `dragon-guard/index.ts`, `dragon-guard/panel.ts`, `dragon-inquiry.ts`, `dragon-scroll.ts`, `dragon-tongue.ts`, `kobold-housekeeping.ts`

Removed all 13 file-local `Symbol.for("pantry.*")` consts. Updated JSDoc examples in 3 publisher files. Updated in-code doc comments in 2 files.

## Commits

| Hash      | Message                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `12cbaee` | feat(amp): add berrygems/lib/globals.ts with PANTRY_KEYS and typed helpers |
| `708cecd` | feat(amp): migrate 7 publisher sites to registerGlobal(PANTRY_KEYS.X)      |
| `65a4d58` | feat(amp): migrate 15 consumer sites to getGlobal(PANTRY_KEYS.X)           |

## Verification Gate Results

```
globalThis as any in extensions:    0  (SC-4 PASS)
Symbol.for("hoard.*") in codebase:  0  (SC-3 PASS — no regression)
Symbol.for("pantry.*") in globals:  5  (exactly the 5 canonical keys)
file-local Symbol.for consts:       0  (noUnusedLocals would have caught any missed)
tsc --project berrygems/tsconfig.json: exit 0  (SC-5 PASS)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `getGlobal` import in publisher-only files**

- **Found during:** Task 2 tsc verification
- **Issue:** `dragon-parchment.ts`, `dragon-image-fetch.ts`, and `kitty-gif-renderer.ts` are publishers only — they don't call `getGlobal`. Adding `getGlobal` to their imports caused `TS6133: 'getGlobal' is declared but its value is never read`.
- **Fix:** Removed `getGlobal` from imports in these three files; kept only `PANTRY_KEYS, registerGlobal`.
- **Files modified:** `dragon-parchment.ts`, `dragon-image-fetch.ts`, `kitty-gif-renderer.ts`
- **Commit:** `708cecd`

**2. [Rule 2 - Missing] RESEARCH.md line numbers were approximate for dragon-digestion.ts**

- **Found during:** Task 3 — the RESEARCH.md cited line 2629 for the inline `Symbol.for("pantry.lab")` call; the actual line in the live file was 2620 (the `const lab = ...` assignment).
- **Fix:** Located the actual line via read, applied migration correctly.
- **No separate commit needed** (inline fix during Task 3).

**3. [Discretion] Consumer wrapper functions retained as typed one-liners**

- **Approach chosen:** Keep `function getPanels(): any { return getGlobal(PANTRY_KEYS.parchment); }` rather than inlining `getGlobal` at every call site.
- **Rationale:** Each wrapper has 3–8 call sites; inlining would have created more churn with no correctness benefit. The plan's Task 3 action explicitly permits "preserving the function shape" when getters are called from multiple sites.
- **Policy compliance:** Added `// panels API is untyped at the inter-extension boundary` comment per berrygems/AGENTS.md "no any without comment" rule (the function return type is `any`).

**4. [Rule 1 - Doc] Two in-code Symbol.for references in comments updated**

- **Found during:** Task 3 verification — `dragon-breath/index.ts` JSDoc and `dragon-lab.ts` module comment still referenced `Symbol.for("pantry.*")` strings.
- **Fix:** Updated both to reference `PANTRY_KEYS.breath` / `PANTRY_KEYS.lab` patterns.
- **Files modified:** `dragon-breath/index.ts`, `dragon-lab.ts`
- **Commit:** `65a4d58`

## Known Stubs

None. All 22 call sites are fully wired to the typed helpers.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, file access patterns, or schema changes. The typed registry wraps the pre-existing `globalThis` publish/subscribe pattern with identical runtime semantics and stronger compile-time types.

## Self-Check

**Created files:**

- `berrygems/lib/globals.ts` — FOUND

**Commits:**

- `12cbaee` — FOUND
- `708cecd` — FOUND
- `65a4d58` — FOUND

**Final tsc:** exit 0 — PASS

**Zero `globalThis as any` in extensions:** confirmed

## Self-Check: PASSED
