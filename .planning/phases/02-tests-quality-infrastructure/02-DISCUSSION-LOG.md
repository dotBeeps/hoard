# Phase 2: Tests & Quality Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 02-tests-quality-infrastructure
**Areas discussed:** Spike strategy, Extension coverage depth, Lib coverage depth, Smoke landing, Settings Zod scope, Plan shape

---

## Spike strategy (TEST-03 dragon-guard)

| Option                                       | Description                                                                                                                                                    | Selected |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Dedicated spike plan first (**Recommended**) | P02-03a lands a single-extension harness test for dragon-guard as its own plan; commit + verify gate; then P02-03b fans out to the other 16. Clearest git log. | ✓        |
| Spike first-in-plan                          | One combined TEST-03 plan: dragon-guard first, then the other 16 within the same plan. Fewer plans, spike decision not a commit gate.                          |          |
| Informal/during planning                     | Researcher runs throwaway spike during research phase; planner absorbs findings. Spike invisible in git history.                                               |          |

**User's choice:** Dedicated spike plan first
**Notes:** Matches ROADMAP §Research Flags Carried Forward directive to "budget a spike on `dragon-guard` before fanning out". Explicit commit-gate preserves the decision's visibility.

---

## Extension coverage depth (TEST-03)

| Option                            | Description                                                                                                                                                                | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SC-minimum only (**Recommended**) | Per extension: loads via createTestSession + asserts tool registrations + asserts Symbol.for('pantry.X') publication. No behavioral tool-call tests. Matches ROADMAP SC#3. | ✓        |
| SC-minimum + one behavioral smoke | Above, plus one primary-tool behavioral smoke per extension. Doubles test-authoring time; catches tool-handler regressions.                                                |          |
| Tiered by complexity              | Single-file (14): SC-minimum. Directory (3): SC-minimum + one behavioral smoke. Targets effort where surface area is.                                                      |          |

**User's choice:** SC-minimum only
**Notes:** Phase 2's thesis is "does pi load everything cleanly?" — deeper behavioral coverage deferred to v1.1 per Deferred Ideas.

---

## Lib coverage depth (TEST-02)

| Option                                                               | Description                                                                                                                                                                                             | Selected |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Test pure + fs paths only, skip external-dep paths (**Recommended**) | Each lib module gets a \*.test.ts; code paths hitting network/child-process stay un-asserted with a block-comment explanation. External-dep behavior is covered indirectly via TEST-03 extension tests. | ✓        |
| Recorded fixtures                                                    | Capture canonical responses into tests/fixtures/ and drive modules with file-backed fakes via DI seams. More coverage; requires adding DI hooks some modules lack.                                      |          |
| Local fakes / test servers                                           | http server for giphy+sse, stub child_process for spawn modules, kitty-protocol stdout parser. Closest to prod; heaviest authoring + longest CI.                                                        |          |

**User's choice:** Test pure + fs paths only, skip external-dep paths
**Notes:** Keeps the "no mocks" rule strict and TEST-02 lean. Affected modules: `giphy-source`, `lsp-client`, `pi-spawn`, `sse-client`, `animated-image`, `animated-image-player`.

---

## Smoke test landing (tests/smoke/install.test.ts)

| Option                                                  | Description                                                                                                                                                                                                    | Selected |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Working harness smoke, not yet CI-run (**Recommended**) | Phase 2 lands tests/smoke/install.test.ts with verifySandboxInstall() asserting named extensions + named skills. Runs locally via explicit vitest invocation. Phase 4 wires CI + adds real-install shell step. | ✓        |
| Empty smoke/ subdir + README stub                       | Create the subdir (satisfies SC#1 layout check) with a README explaining Phase 4 will populate it. No test file.                                                                                               |          |
| Placeholder test that skips                             | tests/smoke/install.test.ts exists with a single `it.skip(...)`. Satisfies Vitest discovery; doesn't exercise anything.                                                                                        |          |

**User's choice:** Working harness smoke, not yet CI-run
**Notes:** Gives dot a smoke gate before CI exists. Default `vitest run` excludes `tests/smoke/**` so TEST-01 SC ("exits zero with no tests collected") stays true until tests land.

---

## Settings Zod schema validation

| Option                                        | Description                                                                                                                                                                                      | Selected |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Keep deferred to v1.1 (**Recommended**)       | Stay strict with TEST-01..04. Settings Zod is a real improvement but isn't Active scope; scope-creep risk per PITFALLS §10.                                                                      |          |
| Include: minimal Zod over readPantrySetting() | Add Zod schema for the _current_ known pantry.\* settings keys in lib/settings.ts. Phase 2 unit tests verify it. Natural fit with shared Zod dep. Adds one plan or folds into the lib-test plan. | ✓        |
| Include: skeleton only, no enforcement        | Export empty/loose Zod schema from lib/settings.ts so Phase 2+ can tighten it, but don't enforce in readPantrySetting(). Symbolic landing.                                                       |          |

**User's choice:** Include: minimal Zod over readPantrySetting()
**Notes:** Claude cautioned on scope-creep (PITFALLS §10). User accepted the marginal cost because the Zod dep is already landing. Bounded in CONTEXT.md D-11 — no wrapper expansion permitted in this phase.

---

## Plan shape

| Option                          | Description                                                                                                                                                                               | Selected |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 6 plans (**Recommended**)       | P02-01 infra → P02-02 lib+settings-Zod — parallel with → P02-03 spike → P02-04 fanout+canary → P02-05 lint-skills → P02-06 smoke. Clear wave boundaries, one deliverable per plan.        | ✓        |
| 5 plans — fold smoke into infra | Above but P02-01 also lands the smoke test; drops P02-06. Risk: infra plan becomes bigger; blocks all later plans.                                                                        |          |
| 4 plans — coarser               | P02-01 infra (incl. smoke) → P02-02 all unit tests → P02-03 all TEST-03 (spike + fanout + canary) → P02-04 linter. Matches 'coarse' granularity most literally but buries spike decision. |          |

**User's choice:** 6 plans
**Notes:** Waves per CONTEXT.md D-20: wave 1 = {P02-01}; wave 2 = {P02-02, P02-03}; wave 3 = {P02-04, P02-05}; wave 4 = {P02-06}.

---

## Claude's Discretion

Ceded to planner per CONTEXT.md "Claude's Discretion" section:

- Canary test extension pair choice (D-05) — any real publisher→consumer `globalThis` round-trip pair.
- `compatibility` field schema shape in frontmatter Zod (D-12).
- `PANTRY_KEYS` ingestion strategy for body lint (D-14) — dynamic import preferred; regex fallback acceptable.
- Helper factory factoring in `tests/helpers/` (D-02/D-03) — emerges from dragon-guard spike.
- Per-file test internal structure (describe/it grouping).
- Top-of-file block comment prose for lib tests documenting what they don't assert (D-07).

## Deferred Ideas

Surfaced and deferred during discussion (full list in CONTEXT.md `<deferred>`):

- Per-extension behavioral tool-call tests (deeper than SC-minimum) → v1.1.
- Recorded fixtures / local fakes for network/spawn lib paths → v1.1.
- Vitest `--coverage` reporting → PROJECT.md deferred.
- Settings v2 / full Zod-layered settings API → v1.1+ (explicitly bounded by D-11).
- `z.toJSONSchema()` export of frontmatter schema → Phase 3 DOCS-03 or v1.1.
- README inventory completeness check → Phase 3 DOCS territory.
- Non-loosening policy text in `morsels/AGENTS.md` → Phase 3 policy prose.
- Dependabot + keywords + repository field in root package.json → v1.1.
