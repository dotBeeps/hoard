# Phase 1: Amputation Cleanup & tsc-Green - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 01-amputation-cleanup-tsc-green
**Areas discussed:** PANTRY_KEYS module shape, Dragon-guard dead ally-mode, hoard-\* morsel disposition, .claude/ sweep scope, Hoard-flavor cleanup beyond carve-out, den/features/ archive disposition

---

## Gray Area Selection

| Option                      | Description                                                                          | Selected |
| --------------------------- | ------------------------------------------------------------------------------------ | -------- |
| PANTRY_KEYS module shape    | AMP-05 shape open: const object vs named exports; typed helper now or later          | ✓        |
| hoard-\* morsel disposition | Delete / tombstone / string-only scrub for hoard-allies + hoard-sending-stone skills | ✓        |
| .claude/ sweep scope        | How deep beyond the two locked deletions                                             | ✓        |
| Dragon-guard dead ally-mode | Remove now (AMP-03) vs defer post-v1.0                                               | ✓        |

**Deferred initially, surfaced later:** Commit granularity/ordering (left to planner default), Hoard-flavor cleanup beyond carve-out (discussed), den/features/ archive disposition (discussed).

---

## PANTRY_KEYS module shape

### Q1: Export shape

| Option                                          | Description                                                      | Selected |
| ----------------------------------------------- | ---------------------------------------------------------------- | -------- |
| Single const object `PANTRY_KEYS` (Recommended) | One import site, canonical key list for TEST-04 lint             | ✓        |
| Named per-key exports                           | `PARCHMENT_KEY` etc., tree-shakable, harder for linter to ingest |          |
| Both — object + named re-exports                | Two surfaces to sync                                             |          |

**User's choice:** Single const object `PANTRY_KEYS`.
**Notes:** Aligns with CONCERNS.md "single source of truth" framing and Phase 2 TEST-04 consumption.

### Q2: Typed helper scope

| Option                                                          | Description                                        | Selected |
| --------------------------------------------------------------- | -------------------------------------------------- | -------- |
| Yes, bless `getGlobal<T>`/`registerGlobal<T>` now (Recommended) | Kills 16+ `as any` pattern sites                   | ✓        |
| Defer to later phase                                            | Smaller v1.0 surface, next rename repeats the miss |          |
| Claude's discretion                                             |                                                    |          |

**User's choice:** Yes, bless it now.

### Q3: Migration scope

| Option                                       | Description                                                             | Selected |
| -------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| Migrate all 16+ call sites now (Recommended) | `rg 'globalThis as any' berrygems/extensions` becomes verification gate | ✓        |
| Helper-available only, defer migration       | Smaller diff, leaves inconsistency                                      |          |
| Claude's discretion                          |                                                                         |          |

**User's choice:** Migrate all call sites now.

---

## Dragon-guard dead ally-mode

### Q1: Disposition

| Option                                             | Description                                                          | Selected |
| -------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Remove the ally-mode branch entirely (Recommended) | Matches AMP-03 stale API residue scope, simplifies for Phase 2 tests | ✓        |
| Rename env vars, keep mechanism                    | Designs for hypothetical consumer                                    |          |
| Defer to post-v1.0                                 | Deferred pass after Phase 2 test coverage                            |          |
| Claude's call                                      |                                                                      |          |

**User's choice:** Remove the ally-mode branch entirely.

---

## hoard-\* morsel disposition

### Q1: Skill fate

| Option                                    | Description                                                | Selected |
| ----------------------------------------- | ---------------------------------------------------------- | -------- |
| Delete outright (Recommended)             | `rm -rf` both; pi glob auto-drops; cleanest result         | ✓        |
| Tombstone SKILL.md stubs                  | Discoverable pointer to external repo but stubs still ship |          |
| Keep skills, scrub only stale API strings | Produces content-free skills                               |          |
| Delete + add one meta-skill               | Violates "no net-new morsels" out-of-scope rule            |          |

**User's choice:** Delete outright.

---

## .claude/ sweep scope

### Q1: Additional sweep items (multi-select)

| Option                               | Description                                      | Selected |
| ------------------------------------ | ------------------------------------------------ | -------- |
| Delete .claude/parity-map.json       | 147L cc-plugin parity, dead                      | ✓        |
| Delete or rewrite stop-doc-sync.fish | Hard-coded hoard-prefix logic                    | ✓        |
| Fix .claude/settings.json hook paths | 4 broken paths to `/home/dot/Development/hoard/` | ✓        |
| Sweep AGENTS.override.md             | Gitignored local-only, named in grep gate        | ✓        |

**User's choice:** All four.

### Q2: stop-doc-sync.fish treatment

| Option                           | Description                          | Selected |
| -------------------------------- | ------------------------------------ | -------- |
| Delete the hook (Recommended)    | parity-map it syncs is being deleted | ✓        |
| Rewrite prefix list to pantry.\* | Requires pantry parity-map successor |          |
| Claude's discretion              |                                      |          |

**User's choice:** Delete the hook.

### Q3: AGENTS.override.md treatment

| Option                                                    | Description                                             | Selected |
| --------------------------------------------------------- | ------------------------------------------------------- | -------- |
| Minimal scrub — remove only hoard-path refs (Recommended) | Smallest diff passes grep gate                          |          |
| Full rewrite using a template                             | Clean pantry baseline; risk of losing personal settings | ✓        |
| Just satisfy the grep gate                                | Leaves dangling concept references                      |          |

**User's choice:** Full rewrite using a template.
**Notes:** Diverged from recommended; user prioritized clean baseline over preserving personal customizations.

---

## Hoard-flavor cleanup beyond carve-out

### Q1: Jsdoc/comment flavor

| Option                                           | Description               | Selected |
| ------------------------------------------------ | ------------------------- | -------- |
| Scrub — replace with neutral prose (Recommended) | Rename-not-reskin cleanup | ✓        |
| Leave as flavor                                  | jsdoc isn't API surface   |          |
| Claude's discretion per site                     |                           |          |

**User's choice:** Scrub.

### Q2: Dangling attributions / TODOs

| Option                             | Description                             | Selected |
| ---------------------------------- | --------------------------------------- | -------- |
| Fix — remove/update (Recommended)  | Reference non-existent files/extensions | ✓        |
| Out of scope — comments aren't API |                                         |          |

**User's choice:** Fix.

### Q3: AGENTS.md daemon narrative

| Option                                | Description                                                                    | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Fix factual errors only (Recommended) | Path fix locked; rewrite daemon-present-tense framing; leave ETHICS.md persona | ✓        |
| Fix path errors only, leave narrative | Minimal scope                                                                  |          |
| Full AGENTS.md rewrite this phase     | Belongs with Phase 3 DOCS-01                                                   |          |

**User's choice:** Fix the factual errors only.

---

## den/features/ archive disposition

### Q1: Archive treatment

| Option                                          | Description                          | Selected |
| ----------------------------------------------- | ------------------------------------ | -------- |
| Leave untouched — out of scope (Recommended)    | D-05 kills the only live inbound ref | ✓        |
| Move amputated entries to den/features/archive/ | Mechanical, zero runtime effect      |          |
| Add banner to each amputated AGENTS.md          | Cheapest disambiguation              |          |
| Delete amputated den/features/ entries          | Loses planning archaeology           |          |

**User's choice:** Leave untouched.

---

## Claude's Discretion

- Commit granularity / ordering (planner default: one-per-AMP, AMP-04 first)
- Shape of `PANTRY_KEYS` type-export surface (`type PantryKey` etc., add if used)
- `pi-spawn.ts:9` rewrite vs removal (judgment per load-bearing-ness)
- `dragon-digestion.ts:1942` TODO resolution (inline fix vs delete)

## Deferred Ideas

- den/features/ reorganization — out of scope, revisit post-v1.0
- ETHICS.md:167 identity pass — not API, deferred
- Full AGENTS.md post-amputation rewrite — Phase 3 DOCS-01
- Richer typed registry (version negotiation, lifecycle) — scope creep
- Settings schema validation — Phase 2 alongside TEST-04 Zod schema
