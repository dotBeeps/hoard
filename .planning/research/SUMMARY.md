# Project Research Summary

**Project:** pantry v1.0 stabilization milestone
**Domain:** Personal pi-package monorepo (TypeScript extensions + Markdown skills) installed via `pi install github:...`
**Researched:** 2026-04-22
**Confidence:** HIGH

## Executive Summary

Pantry is a post-amputation pi-package — 17 berrygem extensions + 56 morsel skills + 11 shared lib modules — that pi loads at session start via jiti. v1.0 is a **cleanup cut, not a feature milestone**: the work is to stabilize the reduced shape by adding the quality layer (tests, CI, frontmatter lint, install smoke, docs) that was never built. The closest wild analogue is `mitsupi` (mitsuhiko/agent-stuff) — pantry's v1.0 plan is deliberately stricter than mitsupi on CI/tests/install-smoke and deliberately looser on publication (no npm, no agentskills.io).

The recommended stack is decisive and grounded: **Vitest 4.1.5** (with `experimental.viteModuleRunner: false` so tests hit Node 22's native TS stripping, mirroring pi's jiti runtime model), **`@marcfargas/pi-test-harness@0.5.0`** as the only acceptable integration boundary (it runs real pi code with only `streamFn` and tools mocked — hand-rolled fakes are anti-pattern), **`yaml@2.8.3` + `zod@4.3.6`** for frontmatter validation (cutting stale `gray-matter`), **Node 22 LTS** + **GitHub Actions v4** throughout, and **`pnpm/action-setup@v4` before `actions/setup-node@v4`** (order matters for pnpm cache detection).

The critical risks cluster into three buckets. **(1) Amputation residue that teaches agents to call dead APIs** — stale `Symbol.for("hoard.*")` strings and `/home/dot/Development/hoard/` path references survive in morsels, berrygems, and `.claude/` hooks; these must be swept in AMP before anything else. **(2) Module-isolation false greens** — Node's module cache lies about pi's jiti semantics, so any integration test that imports extensions directly will pass locally and fail under real install; harness-first discipline and a "two extensions, one session" canary close this. **(3) Install-smoke tests the wrong codepath** — `verifySandboxInstall` does `npm pack`+install, which is _necessary but insufficient_ for the `pi install github:...` git-clone contract; CI-02 must include both gates (harness-fast + `pi install $GITHUB_WORKSPACE` into `HOME=$(mktemp -d)`). A hard prerequisite: **`tsc --project berrygems/tsconfig.json` is currently RED** (dragon-breath import path bug per CONCERNS.md) and blocks every downstream verification until fixed.

## Key Findings

### Recommended Stack

Single-runner, single-language, Linux-only. Every pick is grounded in a verified npm registry date or canonical upstream (pi-mono). See [STACK.md](./STACK.md) for full rationale.

**Core technologies:**

- **Vitest 4.1.5** (test runner for `berrygems/**`) — zero-config TS+ESM, matches pi-test-harness's own example shape, `viteModuleRunner: false` keeps the "loaded the way pi loads it" invariant
- **`@marcfargas/pi-test-harness@0.5.0`** (integration boundary for every berrygem test + install smoke) — purpose-built for this exact problem; peer-dep floor `pi-coding-agent >= 0.50.0` already satisfied transitively
- **`yaml@2.8.3` + `zod@4.3.6`** (frontmatter linter) — modern ESM deps with native TS types; Zod schema reused by the docs inventory generator (single source of truth)
- **Node 22 LTS** (CI runtime) — 22.18+ strips TS natively, so no secondary loader (tsx/ts-node) in the loop
- **pnpm 10.x** (inside `berrygems/`) — already committed (`lockfileVersion: 9.0`); **order matters on GHA — `pnpm/action-setup@v4` before `actions/setup-node@v4`**
- **GitHub Actions v4 throughout** (`checkout@v4`, `pnpm/action-setup@v4` with `cache: true`, `setup-node@v4`) — canonical 2026 recipe

**Explicit rejections (tempting but wrong):** Jest (CJS-first fights ESM), ts-node (obsoleted by native Node TS + tsx), gray-matter (last publish 2023-07, stale js-yaml), hand-rolled ExtensionAPI fakes (re-implementing pi), docker smoke runner (over-engineered for ubuntu-latest), cross-OS matrix (out of scope), npm publish (out of scope).

### Expected Features

v1.0 feature set is strictly grounded in PROJECT.md Active requirements plus one trivial addition (LICENSE file, absent today despite every morsel declaring `license: MIT`). See [FEATURES.md](./FEATURES.md) for the full landscape and competitive-analogue table.

**Must have (P1 — block the v1.0 tag):**

- **AMP-01** — delete husks (`storybook-daemon/`, `psi/`, `dragon-cubed/`, `allies-parity/`, empty `berrygems/extensions/hoard-allies/`) and stale `/home/dot/Development/hoard/` references under `.claude/` and `AGENTS.override.md`
- **TEST-01 + TEST-02 + TEST-03** — Vitest runner, lib unit tests (real fs via `os.tmpdir()`, never mocks), extension integration tests via pi-test-harness
- **TEST-04** — morsel frontmatter lint (Zod-strict: `name`, `description ≤1024`, `license: MIT`, typed `compatibility`; also reject `Symbol.for("hoard.*")` body strings and unregistered `pantry.*` keys)
- **CI-01 + CI-02** — GitHub Actions on ubuntu-latest running tsc + vitest + lint + **both** install-smoke gates (harness AND real `pi install $GITHUB_WORKSPACE` with `HOME=$(mktemp -d)`)
- **DOCS-01..04** — README rewrite, berrygem+morsel inventories (hand-written v1.0 + completeness-check test), per-directory-extension READMEs for `dragon-breath/` and `dragon-websearch/`
- **LICENSE file** — MIT text at root
- **REL-01** — annotated `v1.0.0` tag, primary README install line using `#v1.0.0`, main-branch protection

**Should have (P2 — ship alongside or immediately after):**

- `CHANGELOG.md` with v1.0.0 entry
- GitHub Release at v1.0.0
- Per-berrygem `AGENTS.md` for `dragon-breath/` and `dragon-websearch/` (parity with existing `dragon-guard/AGENTS.md`)
- Dependabot config for GHA action bumps
- `"keywords": ["pi-package", …]` + `"repository"` in root `package.json`
- One demo GIF of `dragon-parchment` in README

**Defer (v1.1+) / explicitly anti-features:** inventory auto-gen script, coverage reporting, architecture diagram, full settings reference, semantic-release, macOS/Windows CI, npm publish, agentskills.io, net-new berrygems/morsels, cross-harness adapters, resurrecting amputated scope, workspace conversion of repo root.

### Architecture Approach

**Runtime architecture is not being redesigned** — manifest discovery, jiti isolation, `globalThis[Symbol.for("pantry.*")]` bus, per-extension `default function (pi: ExtensionAPI)` contract are all in place. This milestone architects only the quality layer. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**

1. **`berrygems/tests/` (sibling tree, NOT co-located)** — mirrors production directory structure 1:1 (`tests/lib/`, `tests/extensions/`, `tests/smoke/`, `tests/helpers/`, `tests/fixtures/`). Sibling layout is forced by module-isolation: co-located `.test.ts` would be swept into `tsc --project berrygems/tsconfig.json` and pollute any tool walking `berrygems/extensions/`. Pi-mono upstream uses the same sibling layout.
2. **`scripts/` at repo root** — `scripts/lib/frontmatter.ts` (shared Zod schema), `scripts/lint-skills.ts` (CI gate), `scripts/gen-docs.ts` (sentinel-block inventory regenerator). Script directory at root because it walks both `berrygems/` and `morsels/`.
3. **`@marcfargas/pi-test-harness` as the only integration boundary** — every test touching `ExtensionAPI` goes through `createTestSession`. Thin `tests/helpers/session.ts` wrapper handles `globalThis[Symbol.for("pantry.*")]` reset between tests.
4. **CI pipeline (single ubuntu-latest job, ordered steps)** — checkout → pnpm → node 22 → install → tsc (shipped) → tsc (tests) → vitest (lib+extensions) → lint-skills → gen-docs --check → vitest (smoke). Order matters: fastest+most-common-failure first.

**Key architectural decisions (the roadmap needs to carry these forward):**

- **Workspace boundary: berrygems-only, NOT repo-root.** Root `package.json` is a pi manifest, not an npm workspace root; stays that way. Root gets `yaml` + `zod` devDeps + two scripts. Mitsupi parity, reversible if ever needed.
- **Test layout: sibling tree, NOT co-located.** Preserves tsc-scope-purity and pi-mono parity.
- **Docs generation: sentinel-block hybrid, CI-drift-gated.** Hand-written narrative + generated inventory blocks. `gen-docs.ts --check` mode fails the PR on drift.
- **Install smoke: Vitest test + fish-local wrapper.** Same `vitest run tests/smoke` command CI runs.
- **Morsel lint: standalone `scripts/` script, NOT pre-commit hook or berrygem.** Markdown validation inside a TS test runner is layering; separate script is the smallest working unit.

### Critical Pitfalls

Ten concrete pitfalls in [PITFALLS.md](./PITFALLS.md), all tied to pantry's specific shape (amputation residue / jiti isolation / `Symbol.for` string bus / frontmatter tolerance / GitHub-install distribution / currently-RED tsc). Top 5 by impact:

1. **Amputation-residue strings teach agents dead APIs** — morsels still document `Symbol.for("hoard.allies")` and `Symbol.for("hoard.stone")`; `.claude/` hooks point at `/home/dot/Development/hoard/`; `.claude/agents/soul-reviewer.md` and `.claude/skills/hoard-verify/` describe amputated subsystems. **Avoid:** delete amputated-subsystem content outright; sweep `rg '/home/dot/Development/hoard/'` + `rg 'Symbol\.for\("hoard\.'` to zero; add body-lint to TEST-04.
2. **`tsc` is currently RED and blocks everything** — `berrygems/extensions/dragon-breath/index.ts:20` imports `../lib/settings.ts` but the file is under `../../lib/settings.ts`. Until this lands in AMP, every downstream gate is built on a broken foundation. **Avoid:** fix as first AMP commit; make tsc a required status check on `main`.
3. **Module-cache false greens vs jiti isolation** — integration tests that `import { X } from "../extensions/..."` get Node's shared cache; pi gives each extension a fresh jiti context via `Symbol.for` bus. **Avoid:** harness-first (every TEST-03 uses `createTestSession`); one explicit "two extensions, one session" canary; grep-gate forbidding `../extensions/` imports in `*.test.ts`.
4. **Install smoke tests wrong codepath** — `verifySandboxInstall` does `npm pack` + install; `pi install github:...` is git-clone. Both must be gates. **Avoid:** CI-02 includes harness-fast AND `HOME=$(mktemp -d) pi install $GITHUB_WORKSPACE && pi list`; assertions check **named** extensions/skills, not just counts.
5. **Symbol-key drift silently no-ops** — the rename just burned three morsels; string literals are invisible to tsc. **Avoid:** centralize in `berrygems/lib/globals.ts` (`PANTRY_KEYS` const); TEST-04 lints skill bodies against that constant's exported key list.

Secondary but notable: frontmatter schema decay over time (Pitfall 4 — policy in `morsels/AGENTS.md`: "fix the skill, don't loosen the schema"), every main push is a breaking release (Pitfall 6 — pinned install in README + `release` branch + branch protection), scope creep during cleanup (Pitfall 10 — `refactor(...)` scoped commits in this milestone are a red flag).

## Implications for Roadmap

Research yields a clear **6-phase structure** with a hard critical-path chain. The dependency graph is forced by three constraints: (1) AMP-01 must land before tests/docs because they reference the same surface, (2) test infrastructure unblocks multiple parallel test deliverables but itself has no prerequisites beyond AMP, (3) REL-01 requires every Active gate green.

### Phase 1: AMP (Amputation Cleanup + tsc Green)

**Rationale:** Everything downstream reads or runs against the tree. Husks + stale strings + red tsc poison every later gate. Largest single unblocker.
**Delivers:** Clean working tree; `rg hoard` returns only `.planning/`/`den/` archives; `.claude/` hooks point at pantry paths; `tsc --project berrygems/tsconfig.json` returns zero errors; `lib/globals.ts` centralizes `PANTRY_KEYS`.
**Addresses:** AMP-01 (PROJECT.md); the tsc-red Known Bug in CONCERNS.md.
**Avoids:** Pitfalls 1 (residue), 2 (currently-red tsc), 3 (Symbol-key drift — centralization here, lint in TEST phase), 8 (orphaned `.claude/` hooks), 10 (scope creep framing — write anti-features list adjacent to PROJECT.md Active before starting).

### Phase 2: Quality Infrastructure Foundation

**Rationale:** Test runner config, harness helpers, frontmatter schema module, and tsconfig.tests.json must exist before any actual tests or lint scripts are written.
**Delivers:** `berrygems/vitest.config.ts`, `berrygems/tsconfig.tests.json`, `berrygems/tests/helpers/` (session wrapper + settings-tmpdir + globals-reset), `berrygems/tests/fixtures/`, `scripts/lib/frontmatter.ts` (Zod schema as single source of truth), root `package.json` devDeps (`yaml`, `zod`) + scripts (`lint:skills`, `gen:docs`), `berrygems/package.json` devDeps (`vitest`, `@marcfargas/pi-test-harness`).
**Uses:** Vitest 4.1.5, pi-test-harness 0.5.0, yaml 2.8.3, zod 4.3.6 from STACK.md.
**Implements:** Architecture Components 1+2+3 scaffolding (no tests yet).
**Avoids:** Pitfall 3 (single-schema reuse by lint + gen-docs), Pitfall 4 (Zod strict schema defined once, not accreted).

### Phase 3a: Tests (parallel — TEST-02, TEST-03, TEST-04)

**Rationale:** Once Phase 2 scaffolding exists, the three test deliverables are mutually independent. TEST-02 cheapest to debug; TEST-03 highest-complexity; TEST-04 standalone and can ship first.
**Delivers:** One `tests/lib/<module>.test.ts` per lib module (11 files); one `tests/extensions/<extension>.test.ts` per extension (17 files) asserting tool registration + `Symbol.for` publication; `scripts/lint-skills.ts` rejecting the 7 documented failure modes.
**Addresses:** TEST-01 (runner already in Phase 2), TEST-02, TEST-03, TEST-04.
**Avoids:** Pitfall 2 (harness-first discipline; grep-gate on `../extensions/` imports), Pitfall 4 (Zod-strict schema + morsels/AGENTS.md non-loosening policy).

### Phase 3b: Docs Inventories + Per-Extension READMEs (parallel with 3a)

**Rationale:** Depends on `scripts/lib/frontmatter.ts` (Phase 2) but not on any test. Hand-written inventories per FEATURES.md decision, plus completeness-check test catching drift at PR time.
**Delivers:** `scripts/gen-docs.ts` with sentinel-block regeneration + `--check` mode; hand-written inventory content in README; per-directory-extension READMEs for `dragon-breath/` and `dragon-websearch/`; DOCS-01 README rewrite reflecting post-amputation shape; CI-badge line; dual install instructions (pinned `#v1.0.0` primary + "tracks main" secondary).
**Addresses:** DOCS-01, DOCS-02, DOCS-03, DOCS-04.
**Avoids:** Pitfall 9 (inventory drift via `--check`), Pitfall 6 (pinned install as primary), UX pitfalls (CI badge, LICENSE alignment).

### Phase 4: CI Pipeline

**Rationale:** Composes local commands into GHA workflow. Every command CI runs must already work locally; this phase is pure orchestration.
**Delivers:** `.github/workflows/ci.yml` with canonical step order; `berrygems/tests/smoke/install.test.ts` calling `verifySandboxInstall`; **plus** a second real-install shell step (`HOME=$(mktemp -d) pi install $GITHUB_WORKSPACE && pi list`) asserting named extensions/skills.
**Addresses:** CI-01, CI-02.
**Avoids:** Pitfall 5 (BOTH install-smoke gates required), Pitfall 7 (harness-load test catches jiti-specific failures tsc misses).

### Phase 5: Release (REL + P2 differentiators)

**Rationale:** Every Active gate green; cut the tag and close the loop. Bundle P2 items that are cheap and natural companions.
**Delivers:** `LICENSE` file, `CHANGELOG.md` v1.0.0 entry, `v1.0.0` annotated tag, GitHub Release, main-branch protection (tsc + vitest + lint + smoke as required status checks; one approval required), `dragon-breath/AGENTS.md` + `dragon-websearch/AGENTS.md`, root `package.json` keywords + repository fields, `.github/dependabot.yml`, optional `release` branch.
**Addresses:** REL-01; most of FEATURES.md P2 list.
**Avoids:** Pitfall 6 (branch protection + pinned-install policy + release branch), Pitfall 10 (pre-tag checklist).

### Phase Ordering Rationale

- **AMP before anything** — `tsc` is RED and residue strings would be tested/documented into permanence if left. Architecture research confirms every later phase reads or runs against the tree.
- **Infrastructure before tests** — shared fixtures; writing tests without them means inline-duplicating setup or retrofitting.
- **Tests + Docs parallel (3a + 3b)** — Both depend on Phase 2, neither on the other. Shortens critical path.
- **CI after tests/docs** — CI composes commands; author local invocations in Phase 3 exactly as CI will call them so Phase 4 is copy-paste.
- **Release last** — gates on every Active item green.

### Research Flags

**Phases likely needing deeper research during planning:**

- **Phase 3a (tests — specifically TEST-03 extension integration):** 17 extensions × harness API mastery. Harness may not cover every pi event pantry uses (`resources_discover`, `session_before_compact`). Plan `/gsd-research-phase` on harness playbook DSL + spike on `dragon-guard` (richest directory extension) before fanning out.
- **Phase 4 (CI — specifically CI-02 real install step):** Pi's git-install codepath details (symlink handling after clone, `HOME` layout, timing of `berrygems/node_modules/` symlink repair) are under-documented. Budget a small spike.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (AMP):** Pure deletion + grep-sweep + one import-path fix.
- **Phase 2 (Infrastructure):** Canonical patterns documented in STACK.md.
- **Phase 3b (docs):** Sentinel-block regeneration is ~80-line script.
- **Phase 5 (release):** Standard GitHub mechanics.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                              |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Versions verified against live npm registry (2026-04-22); Context7 confirmed vitest 4, zod 4, yaml, ajv shapes; pi-test-harness README directly inspected                          |
| Features     | HIGH       | Grounded 1:1 in PROJECT.md Active; competitive baseline from installed `mitsupi` at `/home/dot/.npm/lib/node_modules/mitsupi/`; anti-features trace to explicit Out-of-Scope lines |
| Architecture | HIGH       | Test-layout and harness-boundary decisions grounded in pi-mono upstream (verified against `badlogic/pi-mono` HEAD); workspace decision grounded in mitsupi parity                  |
| Pitfalls     | HIGH       | Pitfalls 1/3/7/8 grounded in fresh CONCERNS.md audit; 2/5 grounded in pi-test-harness + pi-mono source; 4/6/9/10 MEDIUM on specifics but HIGH on remediation mechanics             |

**Overall confidence:** HIGH. The research is decisive because pantry's shape (post-amputation, content-only, single-user, GitHub-install) narrows the design space dramatically — most "should we?" questions reduce to "what does PROJECT.md Out-of-Scope say?" or "what does mitsupi do?"

### Gaps to Address

- **Pi install git-clone codepath specifics** (Phase 4 flag). Public docs don't enumerate exactly how `pi install github:…` handles `berrygems/node_modules/` symlink repair vs a freshly-cloned tree. Plan: small spike in Phase 4; fallback is a shell step running the documented symlink-repair recipe before `pi list`.
- **Harness coverage of edge pi events** (Phase 3a flag). `@marcfargas/pi-test-harness@0.5.0` covers common events but support for `resources_discover` / `session_before_compact` / context-event mutation is unconfirmed. Plan: wrap the harness in `tests/helpers/` using its own session primitives if needed — do not hand-roll a second harness.
- **Hoard-themed flavour text inside surviving berrygems (dragon-curfew, dragon-musings)** — persona prose references "hoard" intentionally. Flag for Phase 1: write a prose-vs-API-string policy into PROJECT.md or AGENTS.md so future sweeps don't repeatedly re-litigate.
- **Symbol-key centralization (`lib/globals.ts`) scope call.** Judgement on Pitfall 3 vs Pitfall 10. Recommendation: include in AMP — cleanup of amputation fallout, not speculative. Defer if it grows past ~30 lines.

## Sources

### Primary (HIGH confidence)

- **Context7:** `/vitest-dev/vitest`, `/colinhacks/zod`, `/jonschlinkert/gray-matter`, `/privatenumber/tsx`, `/ajv-validator/ajv`, `/pnpm/action-setup`
- **Live npm registry (2026-04-22):** `vitest@4.1.5`, `@marcfargas/pi-test-harness@0.5.0`, `yaml@2.8.3`, `zod@4.3.6`, `gray-matter@4.0.3` (last publish 2023-07-12)
- **`github.com/marcfargas/pi-test-harness`** — public API surface
- **`github.com/badlogic/pi-mono`** — extension loader contract, sibling `test/` layout precedent, vitest config shape, CI workflow pattern, full `ExtensionAPI` surface
- **`/home/dot/.npm/lib/node_modules/mitsupi/`** (installed locally) — closest pi-package analogue
- **`.planning/codebase/CONCERNS.md`** (2026-04-22 audit) — authoritative amputation-residue enumeration
- **`.planning/codebase/ARCHITECTURE.md` + `STRUCTURE.md` + `TESTING.md`** — current pantry runtime architecture
- **`PROJECT.md`** — canonical Active / Out-of-Scope / Constraints
- **`.claude/rules/testing.md`** — "never mock the DB" rule

### Secondary (MEDIUM confidence)

- Vitest 4 release notes (vitest.dev/blog)
- pkgpulse.com 2026 runner comparison
- VS Code extension-pack and dotfiles-monorepo conventions

### Tertiary (LOW confidence)

- No pantry-specific post-mortems exist (v1.0 hasn't shipped). Pitfalls 4/6/9/10 inferred from analogous ecosystems + pantry's specific constraints; remediation mechanics are mechanical not speculative.

---

_Research completed: 2026-04-22_
_Ready for roadmap: yes_
