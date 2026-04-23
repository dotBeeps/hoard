# Phase 2: Tests & Quality Infrastructure - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the test + lint spine for pantry so TEST-01..04 all close. Concretely:

- A Vitest 4.1.5 runner wired in `berrygems/` with the sibling `berrygems/tests/` tree (`helpers/ fixtures/ lib/ extensions/ smoke/`), `berrygems/vitest.config.ts`, `berrygems/tsconfig.tests.json`, and a `pnpm --dir berrygems test` that exits zero.
- Unit coverage for every module in `berrygems/lib/` (12 modules) via real filesystem (`os.tmpdir()`).
- Integration coverage for every extension in `berrygems/extensions/` (17 total) via `@marcfargas/pi-test-harness` `createTestSession` — never via direct `../extensions/` imports — plus a canary "two extensions, one session" test exercising cross-extension `globalThis` round-trip.
- A standalone `scripts/lint-skills.ts` validating all surviving `morsels/skills/*/SKILL.md` frontmatters against a shared Zod schema at `scripts/lib/frontmatter.ts`, and rejecting stale `Symbol.for("hoard.*")` + unregistered `pantry.*` key references in skill bodies.
- A locally-runnable install-smoke test (`tests/smoke/install.test.ts`) that Phase 4 CI will later invoke.
- A minimal Zod schema layered over `readPantrySetting()` in `berrygems/lib/settings.ts`, exercising the same Zod dependency that TEST-04 requires.

**Out of scope (preserved boundary):**

- CI wiring itself (`.github/workflows/ci.yml`) — Phase 4.
- README rewrite, inventories, per-directory-extension READMEs, LICENSE — Phase 3.
- Real `pi install $GITHUB_WORKSPACE` shell step — Phase 4 CI-02 side of the dual smoke.
- Net-new berrygems/morsels, `--coverage` reporting, Node matrix, macOS/Windows CI (PROJECT.md Out of Scope).
- Per-extension behavioral smoke tests beyond the SC-minimum bar (see Decisions).
- Fixture-driven or local-fake coverage for network/spawn code paths in `lib/` (see Decisions).

</domain>

<decisions>
## Implementation Decisions

### TEST-03 roll-out strategy

- **D-01:** Land TEST-03 in two plans, not one. A dedicated single-extension spike plan for `dragon-guard` executes first and commits before any fanout work starts. The spike is the research-flag discharge from ROADMAP §Research Flags Carried Forward ("Budget a spike on `dragon-guard` (richest directory extension) before fanning out across 17 extensions. Do NOT hand-roll a second harness; wrap via `tests/helpers/`.").
- **D-02:** The spike exit criteria are: (a) dragon-guard integration test runs green under `pnpm --dir berrygems test` invoking pi-test-harness `createTestSession`; (b) the test asserts tool registration for every tool dragon-guard registers plus any `Symbol.for("pantry.guard")` publication the extension actually does; (c) any harness gap (e.g. `resources_discover`, `session_before_compact`, context-event mutation per research flag) is either absorbed via a thin wrapper in `berrygems/tests/helpers/` **or** explicitly noted as "unasserted, revisit post-v1.0" in the SUMMARY for that plan. **No hand-rolled second harness.**
- **D-03:** After the spike commits green, the fanout plan replicates the established pattern across the other 16 extensions. If the spike revealed a pattern (e.g. a `helpers/loadExtension(name)` factory), the fanout uses it. The canary "two extensions, one session" test (SC #3) lands inside the fanout plan using the publisher/consumer pair chosen in D-04.

### Extension coverage bar (TEST-03)

- **D-04:** SC-minimum only per extension, no behavioral tool-call tests in Phase 2. Each extension gets one `berrygems/tests/extensions/<name>.test.ts` that asserts:
  1. `createTestSession` loads the extension without error.
  2. Every tool the extension registers (as declared in its `ExtensionAPI.registerTool(...)` calls) is present on the session's tool list.
  3. Any `Symbol.for("pantry.<name>")` the extension claims to publish is present on `globalThis` after load.
     Single-file and directory extensions use the same bar — no tiering. Behavioral tool-call smokes are explicitly deferred; the extension integration surface is sufficient coverage for v1.0's thesis ("does pi load everything cleanly?").
- **D-05:** The canary test pair is **planner's choice** within a constraint: the pair must exercise a real publisher→consumer `Symbol.for("pantry.<name>")` round-trip, not two unrelated extensions that happen to load together. Sensible candidates: `dragon-parchment` (publishes `pantry.parchment`) + any consumer that reads the panel host, or `dragon-guard` + something in its allowlist path. The test file lives at `berrygems/tests/extensions/cross-extension.test.ts` (or similar) and its failure mode is the jiti-isolation canary per PITFALLS §2.

### Lib coverage bar (TEST-02)

- **D-06:** Every module in `berrygems/lib/` gets a `berrygems/tests/lib/<name>.test.ts` (12 modules total, per `ls berrygems/lib/`: `animated-image.ts`, `animated-image-player.ts`, `compaction-templates.ts`, `cooldown.ts`, `giphy-source.ts`, `globals.ts`, `id.ts`, `lsp-client.ts`, `panel-chrome.ts`, `pi-spawn.ts`, `settings.ts`, `sse-client.ts`). Real filesystem via `os.tmpdir()`; no fs mocks, no DB mocks.
- **D-07:** Pure + fs code paths are asserted. Network (`giphy-source` fetch), child-process spawn (`pi-spawn`, `lsp-client`), SSE streaming (`sse-client`), and kitty-terminal protocol emission (`animated-image`, `animated-image-player`) code paths are **not** asserted in Phase 2 unit tests. They remain covered indirectly via TEST-03 integration tests (extensions exercise these through the real runtime). Each test file documents what it skips and why in a top-of-file block comment.
- **D-08:** The `globals.ts` test specifically exercises `registerGlobal` / `getGlobal` round-trip behavior: (a) round-trip preserves type, (b) `getGlobal` on an unregistered key returns `undefined` not throw, (c) `PANTRY_KEYS` object shape matches a snapshot (regression guard if a key is renamed). This is the reference test downstream agents imitate for other lib modules.

### Settings Zod schema validation (lib/settings.ts)

- **D-09:** In Phase 2 scope: add a Zod schema over `readPantrySetting()` in `berrygems/lib/settings.ts`. The shared Zod dep landing for TEST-04 makes marginal cost low; the deferred-from-Phase-1 note already anticipated this placement.
- **D-10:** Schema scope is **minimal**: type every currently-live `pantry.*` settings key (enumerate from the codebase via `rg 'readPantrySetting\(' berrygems` during the lib-test plan — authoritative list is what extensions actually read). Validation mode is `safeParse` + log-and-use-default on mismatch, not throw. Unknown settings keys pass through unchanged (tolerant — we're not building a CLI validator). The `dotsPiEnhancements.*` legacy fallback path is **not** schema-validated (it's legacy compat; leave it alone).
- **D-11:** No wrapper expansion in this phase — resist growing it into a settings-v2 API. PITFALLS §Pitfall 10 explicitly calls settings schema validation a scope-creep magnet; this decision permits _only_ the Zod layer + unit test. Dragon-guard whitelist-bypass nudging (CONCERNS.md §Security) is v1.1 per the deferred-idea trail, not this phase.

### TEST-04 frontmatter + body lint (scripts/lint-skills.ts)

- **D-12:** `scripts/lib/frontmatter.ts` exports a `SkillFrontmatterSchema` Zod schema. Required fields match REQUIREMENTS §TEST-04: `name` (string, equals directory name), `description` (string, non-empty, ≤ 1024 chars), `license: "MIT"` (literal), `compatibility` typed (planner's call on exact shape — likely `{ models?: string[]; runtimes?: string[] }` or similar; decide against one real skill's existing frontmatter, then migrate laggards). The same schema is re-exportable from the morsels side if Phase 3 docs-gen wants to read it.
- **D-13:** `scripts/lint-skills.ts` walks `morsels/skills/*/SKILL.md` (glob), uses `yaml@^2.8` to parse the fenced frontmatter block, pipes into the Zod schema, and on success also scans the skill body text. Body scan rejects:
  - Any `Symbol.for("hoard.*")` string literal (residue gate; PITFALLS §1).
  - Any `Symbol.for("pantry.<name>")` where `<name>` is not a key of the live `PANTRY_KEYS` object exported from `berrygems/lib/globals.ts`.
- **D-14:** How `lint-skills.ts` learns the `PANTRY_KEYS` name list is **planner's call**, but the three viable paths are: (a) dynamic `await import("../berrygems/lib/globals.ts")` under `node --experimental-strip-types` and `Object.keys(PANTRY_KEYS)` — cleanest, matches Phase 1 D-03's enumerable-keys decision; (b) AST-parse with a TS compiler API; (c) regex over the file text. (a) is strongly preferred unless a dynamic import blows up under `--experimental-strip-types` — in which case fall back to (c) with a TODO for (a).
- **D-15:** Exit-code discipline: `lint-skills.ts` exits non-zero on any violation, prints per-file diagnostics grouped by skill directory (not one long stream), and counts violations in a summary line at the end (e.g. `✗ 3 skills failed: ...`). Zero violations → exit 0 with a terse success line.

### Smoke test (tests/smoke/install.test.ts)

- **D-16:** Phase 2 lands a working `berrygems/tests/smoke/install.test.ts` that calls `verifySandboxInstall({ packageDir })` from `@marcfargas/pi-test-harness` and asserts:
  - At least one specific named extension is loaded (e.g. `dragon-parchment`).
  - At least one specific named skill is loaded (e.g. `git`).
  - Counts are a secondary assertion, not the primary one (PITFALLS §5 — named > count).
- **D-17:** The smoke test is excluded from the default `vitest run` invocation via its test glob — it runs via explicit `pnpm --dir berrygems test -- tests/smoke` or `vitest run tests/smoke/install.test.ts`. Reason: smoke is slow (`npm pack` + install), and TEST-01's SC ("exits zero with no tests collected") is specifically about the fast lib+extensions path. Configure the vitest `include` in `berrygems/vitest.config.ts` to `["tests/lib/**/*.test.ts", "tests/extensions/**/*.test.ts"]` by default, with `tests/smoke/**` reachable only via explicit CLI include.
- **D-18:** Phase 4 consumes this file verbatim: CI-02 runs `vitest run tests/smoke` as the harness-fast gate, then adds the `HOME=$(mktemp -d) pi install $GITHUB_WORKSPACE` shell step as the real-install gate. Phase 2 is the author of the harness-fast side; Phase 4 is the wirer.

### Plan shape (6 plans, coarse granularity)

- **D-19:** Phase 2 breaks into 6 plans, executable in waves:
  - **P02-01 Infra** (wave 1): `berrygems/vitest.config.ts`, `berrygems/tsconfig.tests.json`, `berrygems/tests/` tree scaffold (empty subdirs), `pnpm test` script, `berrygems/package.json` devDeps (`vitest@^4.1`, `@marcfargas/pi-test-harness@^0.5`, `@mariozechner/*` peer deps per STACK.md), root `package.json` devDeps (`yaml@^2.8`, `zod@^4.3`), root `package.json` scripts (`lint:skills`). Gates everything downstream.
  - **P02-02 Lib tests + settings Zod** (wave 2, parallelizable with P02-03): all 12 `lib/<name>.test.ts` files per D-06/D-07/D-08, plus the `settings.ts` Zod schema per D-09/D-10/D-11. Bundled because the settings change is a lib edit that wants a lib test.
  - **P02-03 TEST-03 spike** (wave 2, parallelizable with P02-02): dragon-guard integration test + any required `berrygems/tests/helpers/` wrapper. Landing green is the exit criterion.
  - **P02-04 TEST-03 fanout + canary** (wave 3): 16 remaining extension integration tests at the SC-minimum bar + the two-extensions-one-session canary test. Depends on P02-03.
  - **P02-05 TEST-04 linter** (wave 3, parallelizable with P02-04): `scripts/lib/frontmatter.ts` Zod schema + `scripts/lint-skills.ts` walker + body-lint with PANTRY_KEYS ingestion per D-12..D-15. Depends on P02-01 (devDeps landed); independent of the test-writing plans.
  - **P02-06 Smoke test** (wave 4): `berrygems/tests/smoke/install.test.ts` per D-16/D-17. Depends on P02-01 and at least one known-loaded extension/skill (effectively P02-04). Lands last.
- **D-20:** Wave boundaries: wave 1 = {P02-01}; wave 2 = {P02-02, P02-03}; wave 3 = {P02-04, P02-05}; wave 4 = {P02-06}. Config sets `parallelization: true` — let the executor exploit it within a wave.

### Claude's Discretion

- **Canary test extension pair choice** (D-05). Any real publisher→consumer pair that exercises the `globalThis` round-trip; planner picks from what the codebase actually does.
- **`compatibility` field schema shape** (D-12). Derive from what one existing skill's frontmatter actually looks like; don't invent.
- **`PANTRY_KEYS` ingestion strategy for the body lint** (D-14). Prefer dynamic import; fall back to regex if `--experimental-strip-types` chokes on the import path.
- **Helper factory factoring** (D-02/D-03). If the dragon-guard spike produces a `helpers/loadExtension(name)` or `helpers/createPiTestSession(...)` reusable factory, the fanout uses it. If the spike stays bespoke, the fanout can also stay bespoke — 16 near-identical test files is acceptable for this scale.
- **Per-file test internal structure** (describe/it/expect grouping). Vitest idiom per project testing rules; no special requirements.
- **Top-of-file block comment format** (D-07) — documenting what the lib test _doesn't_ assert. Planner picks the prose shape; just needs to be explicit so future-dot doesn't think the module is fully exercised.

### Folded Todos

None folded — `gsd-sdk query todo.match-phase 2` returned zero matches.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope (locked requirements + success criteria)

- `.planning/ROADMAP.md` §Phase 2 — goal, 5 success criteria (Vitest + sibling tests tree + harness-based integration + lint-skills + grep gate), requirements map. Authoritative SC list.
- `.planning/ROADMAP.md` §Research Flags Carried Forward — dragon-guard spike flag for TEST-03; directly motivates D-01..D-03.
- `.planning/ROADMAP.md` §Constraints Carried Forward from PROJECT.md — sibling `berrygems/tests/`, workspace-boundary rule (root `package.json` stays pi-package manifest), fish-not-bash.
- `.planning/REQUIREMENTS.md` §Testing — TEST-01..04 wording (authoritative). TEST-04 spec locks `scripts/lint-skills.ts` + `scripts/lib/frontmatter.ts` location + Zod required fields.
- `.planning/PROJECT.md` §Active + §Constraints + §Out of Scope — audience, distribution shape, test-layout constraint, Linux-only CI scope.

### Research (must read before planning)

- `.planning/research/STACK.md` — exact versions (`vitest@4.1.5`, `@marcfargas/pi-test-harness@0.5.0`, `yaml@2.8.3`, `zod@4.3.6`), canonical `vitest.config.ts` with `experimental.viteModuleRunner: false`, `pi-test-harness` API (`createTestSession`, `verifySandboxInstall`, `createMockPi`, playbook DSL). P02-01's dep set + config file shape come directly from this.
- `.planning/research/PITFALLS.md` §Pitfall 2 (module-cache false greens — harness-first rule for TEST-03), §Pitfall 3 (PANTRY_KEYS centralization + body lint), §Pitfall 4 (frontmatter schema half-life + non-loosening policy), §Pitfall 5 (install smoke needs named assertions, not counts), §Pitfall 10 (scope creep — keep settings Zod tight per D-11). The "Looks Done But Isn't" checklist items for TEST-01..04 are the phase's verification recipe.
- `.planning/research/FEATURES.md` §Table Stakes "Tests that exist and run" + "Morsel frontmatter lint" — domain-level justification. §Anti-Features column confirms no `--coverage`, no hand-rolled `ExtensionAPI` fakes.

### Phase 1 outputs (inputs to Phase 2)

- `.planning/phases/01-amputation-cleanup-tsc-green/01-CONTEXT.md` §Implementation Decisions D-01..D-03 — `PANTRY_KEYS` shape + enumerable-keys decision. The body lint in D-14 consumes `Object.keys(PANTRY_KEYS)` (or equivalent). Do NOT rediscover this; Phase 1 locked it.
- `.planning/phases/01-amputation-cleanup-tsc-green/01-CONTEXT.md` §Deferred Ideas "Settings schema validation" — the forward-pointer that D-09 cashes in.
- `berrygems/lib/globals.ts` (shipped in Phase 1) — the authoritative `PANTRY_KEYS` export. Lint-skills.ts ingests from here.

### Layer conventions

- `AGENTS.md` §Verification — the automated gate before this phase is `tsc`; Phase 2 adds `vitest run` + `lint-skills` as new gates. Fish-not-bash rule for any repo-local script except `lint-skills.ts` which is explicitly Node (`--experimental-strip-types`).
- `berrygems/AGENTS.md` §Structural Rules — `no any` policy (affects the typed Zod→TS inference chain in `scripts/lib/frontmatter.ts`).
- `morsels/AGENTS.md` §Frontmatter requirements — the Zod schema in D-12 must match this doc's prose, or this doc is updated at the same time. Phase 2 is permitted to propose schema changes _provided_ the prose updates with them; Phase 3 owns the "don't loosen schema" policy prose, but if the schema ends up documented wrongly here, fix it in-place.
- `.claude/rules/testing.md` — project-local testing rules: real fs via testcontainers/tmpdir, never mock the DB, TDD for bug fixes, test behavior not implementation, AAA structure, Vitest `*.test.ts` convention.

### Repo structure

- `.planning/codebase/STRUCTURE.md` — `berrygems/lib/` has 12 modules (post-Phase 1); `berrygems/extensions/` has 17 (14 single-file + 3 directory). Test-count targets match these numbers.
- `.planning/codebase/TESTING.md` — documents the "no tests today" starting state + the pi-test-harness availability claim. Reference when wiring TEST-01.
- `.planning/codebase/ARCHITECTURE.md` §Cross-extension communication + §Error handling — explains why the canary test's `globalThis` round-trip is load-bearing.
- `.planning/codebase/CONCERNS.md` §Settings file exposure + §Dragon-guard whitelist bypass — motivates D-09 but also bounds it per D-11 (no expansion in this phase).

### External docs (via Context7 / primary sources)

- pi-test-harness public API — https://github.com/marcfargas/pi-test-harness (STACK.md Sources line). Planner may need to re-verify `createTestSession`/`verifySandboxInstall` signatures against the v0.5.0 tag.
- Vitest 4 — `vitest.config.ts` shape, `experimental.viteModuleRunner: false` semantics. Fetch current docs via Context7 if anything in STACK.md's canonical config block drifts against 4.1.x.
- Zod 4 — `SchemaType.parse/safeParse`, `z.toJSONSchema()` if Phase 3 later wants a JSON-Schema emit. Reference only; not load-bearing for Phase 2.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `berrygems/lib/globals.ts` (Phase 1) — `PANTRY_KEYS` const + typed `getGlobal<T>()` / `registerGlobal<T>()` helpers. Lint-skills.ts body-lint uses `Object.keys(PANTRY_KEYS)` (or equivalent) as the allowlist for `Symbol.for("pantry.<name>")` references. The globals.ts test (D-08) is the reference pattern other lib tests imitate.
- `berrygems/lib/settings.ts` — `readPantrySetting()` already exists with `dotsPiEnhancements.*` legacy fallback; D-09 layers Zod validation over the _forward_ (`pantry.*`) branch only. Legacy branch is untouched.
- `berrygems/package.json` pnpm lockfile — `lockfileVersion: 9.0`; pnpm 10.x resolves cleanly. New devDeps land here (Vitest + harness), not at root.
- Root `package.json` — the pi-package manifest. D-19 P02-01 adds `devDependencies.yaml`, `devDependencies.zod`, and `scripts["lint:skills"]` here (root), keeping the workspace-boundary constraint intact.
- pi-install-provided `berrygems/node_modules/@mariozechner/*` symlinks satisfy peer deps for the harness locally; CI needs these added as explicit devDependencies per STACK.md Installation note.

### Established Patterns

- Cross-extension APIs publish via `globalThis[Symbol.for("pantry.<name>")]`; extensions cannot `import` each other. TEST-03 MUST go through `createTestSession` — direct `../../extensions/<name>` imports break the jiti-isolation assumption and produce false greens (PITFALLS §2). Enforced by the ROADMAP SC #5 grep gate.
- `pnpm --dir berrygems <cmd>` is the invocation pattern for everything under `berrygems/`; there is no root npm workspace. Phase 2's `pnpm --dir berrygems test` invocation respects this.
- Vitest `*.test.ts` co-located-in-same-dir is the ecosystem default, but pantry's ROADMAP constraint is **sibling** `berrygems/tests/`. Do not co-locate. Preserves `tsc`-scope purity (main `tsconfig.json` excludes tests; `tsconfig.tests.json` owns them).
- Fish for repo-local scripts except where Node is required. `scripts/lint-skills.ts` is Node because the Zod + yaml + file-reading surface is cleaner in TS; `node --experimental-strip-types` invocation fits the no-compile ethos.

### Integration Points

- **P02-01 Infra blocks everything else.** `vitest.config.ts` + `tsconfig.tests.json` + tests tree + devDeps are the single prerequisite for P02-02..P02-06.
- **P02-02 (lib + settings Zod) interfaces with P02-05 linter** through the shared Zod dep. Same version, same schema authoring idioms. But there is no runtime coupling — each runs independently.
- **P02-03 spike → P02-04 fanout** is a hard dependency. Fanout must not start until spike commits green, because the fanout's test shape is seeded by whatever pattern the spike settles on.
- **P02-04 fanout includes the canary** (D-03) — keeps the two-extensions-one-session test adjacent to the fanout logic it canary-guards.
- **P02-05 linter is independent of test-writing plans** aside from devDeps. Can land in parallel with P02-04.
- **P02-06 smoke** depends on infra + at least one shipped extension integration test (so `verifySandboxInstall`'s assertions have concrete names to grep for). Lands last to catch any late-shifting assumption about what "loaded extensions" means.
- **Phase 3 DOCS integration:** P02-05's `scripts/lint-skills.ts` exit-code contract (D-15) is what Phase 4 CI invokes. Phase 3 DOCS-03 morsel inventory generator may also want to read `scripts/lib/frontmatter.ts` Zod types — export them in a form re-importable without circular dep risk.
- **Phase 4 CI-02 integration:** Phase 2 owns `tests/smoke/install.test.ts` (D-16/D-18). Phase 4 wraps it into CI + adds the real-install shell step. Phase 2's default `vitest run` excludes `tests/smoke/**` (D-17) so TEST-01's "exits zero with no tests collected" SC isn't accidentally invalidated once tests start accruing.

</code_context>

<specifics>
## Specific Ideas

- **Dragon-guard as the spike subject is research-flagged, not arbitrary.** It's the richest directory extension (most tools, most settings surface, most ExtensionAPI events touched), so any harness gap will surface here first — which is exactly what a spike exists for. Do NOT substitute a simpler extension as "easier to start with"; that defeats the spike's purpose.
- **The `no direct ../extensions/` rule is a grep gate, not a convention.** ROADMAP SC #5 codifies it: `rg 'from "\.\./\.\./?extensions/' berrygems/tests/**/*.test.ts` must return zero. The spike and fanout plans should treat this as a pre-commit check, not a code-review suggestion.
- **Named assertions beat counts.** D-16 smoke asserts `dragon-parchment` and `git` by name. If a berrygem gets renamed during a PR, the count-based assertion would stay green and the name-based assertion would fail loudly — which is the desired behavior per PITFALLS §5.
- **The body-lint ingests the live PANTRY_KEYS list.** D-14's dynamic-import path is preferred because it means renaming or removing a key automatically retightens the allowlist. Regex fallback exists but has the staleness failure mode the centralization was meant to kill.
- **Settings Zod mode = safeParse + default, not throw.** D-10's failure mode choice matters: a malformed `~/.pi/agent/settings.json` should not brick pantry load. Log the Zod issue, use the default, continue. A thrown Zod error at import time would break every extension that uses settings.
- **Don't write tests for the `scripts/` tree.** `scripts/lint-skills.ts` is a CLI; its test is "run it against the real morsels corpus and assert exit 0" — which Phase 4 CI covers. An in-tree unit test of the linter would duplicate the Zod schema's own testing semantics.

</specifics>

<deferred>
## Deferred Ideas

- **Per-extension behavioral tool-call tests** (deeper than SC-minimum). Every extension calls `registerTool` with a handler; a smoke-call asserting handler behavior is a real improvement but doubles test authoring. Defer to v1.1 with a dedicated "behavioral coverage" milestone if content grows or a bug shows up that deeper tests would have caught.
- **Recorded fixtures or local fakes for network/spawn lib paths.** `giphy-source`, `lsp-client`, `pi-spawn`, `sse-client`, `animated-image*` code paths hit external boundaries. Not in TEST-02 scope per D-07. Queue for v1.1 if one of these regresses silently.
- **`--coverage` reporting.** PROJECT.md + FEATURES.md §Differentiators explicitly defer this. Don't add Vitest's `--coverage` flag to any plan.
- **Settings v2 / full Zod-layered settings API.** D-11 forbids growing the wrapper in this phase. A real settings-API milestone (CLI validator, error reporting, migration paths) belongs in v1.1+.
- **JSON Schema export of the morsel frontmatter schema.** `z.toJSONSchema()` is a one-liner and `morsels/schema/skill-frontmatter.json` would be a trip wire per PITFALLS §4. Queue for Phase 3 DOCS-03 if the inventory generator wants language-portable contracts, or v1.1 otherwise.
- **Completeness check for README inventory** (PITFALLS §9). Lives in Phase 3 DOCS territory — Phase 2's linter scope is frontmatter + body strings, not inventory-vs-filesystem reconciliation.
- **Non-loosening policy text in `morsels/AGENTS.md`** (PITFALLS §4). Policy prose belongs in Phase 3 docs work; Phase 2 authors the schema, Phase 3 writes the policy around it.
- **Dependabot + keywords + repository field in root package.json.** FEATURES.md §Differentiators — cheap add-ons but explicitly v1.1 territory. Phase 2's `package.json` edits are scoped to devDeps + scripts only.

</deferred>

---

_Phase: 02-tests-quality-infrastructure_
_Context gathered: 2026-04-23_
