# Feature Research

**Domain:** Stabilization + v1.0 tag of a personal-use pi-package monorepo (TypeScript extensions + Markdown skills) installed via `pi install github:...`. Audience is dot's own machines; public installability is a byproduct.
**Researched:** 2026-04-22
**Confidence:** HIGH for table-stakes set (grounded in PROJECT.md Active requirements + the `mitsupi` pi-package published by the closest analogous author). MEDIUM for differentiators (judgment calls tuned to audience). HIGH for anti-features (each one traces to an explicit Out-of-Scope line in PROJECT.md).

## What counts as "v1.0-ready" for this domain

A pi-package repo is not a library, not an application, and not a public product. The closest analogues are:

- **`mitsupi` / `mitsuhiko/agent-stuff`** — Armin Ronacher's pi-package (npm-published). Ships: `README.md` with full skill + extension inventory as hyperlinked bullet lists, `AGENTS.md`, `CHANGELOG.md`, `LICENSE` (on disk at `/home/dot/.npm/lib/node_modules/mitsupi/`), `package.json` declaring `"keywords": ["pi-package", "pi-extension", "pi-skill", "pi-theme"]`. **No tests, no CI visible in the installed package**, but a `make-release` plumbing command for changelog-driven releases. That's the honest current state of the art for this format.
- **VS Code extension packs** — single `package.json` + `README.md` describing bundled extensions, CHANGELOG, LICENSE. No tests beyond what each extension ships.
- **Claude Code plugin repos** (`.claude-plugin/plugin.json` manifest) — README + LICENSE + per-plugin docs are the norm.
- **Neovim plugin-manager-installable configs** (LazyVim, NvChad) — README, screenshots/demos, per-module docs, lockfile or version tag. CI is usually a lint-only workflow.
- **Personal dotfiles monorepos** (Lunkentuss, niqodea, Lissy93) — README, LICENSE, often a `Makefile`/`install.sh` and a CI smoke-install on Ubuntu.

**Synthesis:** the "v1.0-ready" bar for a personal pi-package is _lower_ than a published library (no semver policy, no API stability contract, no migration guides) but _higher_ than a raw dotfiles dump (it has shipped content with a real consumer contract — the pi harness — so install correctness must be mechanically checkable). The pantry PROJECT.md has already calibrated correctly: tests + CI + install smoke + inventory + README + tag + license. That IS the table-stakes list for this domain.

## Feature Landscape

### Table Stakes (Users Expect These)

Every entry here maps to at least one `Active` requirement in PROJECT.md. Missing any of these makes the "stabilized and published v1.0" thesis false.

| Feature                                                             | Why Expected                                                                                                                                                                                                                                        | Complexity | Notes                                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clean working tree (no amputation husks)                            | A v1.0 tag pointing at a tree that still contains `storybook-daemon/`, `psi/`, `dragon-cubed/`, `allies-parity/`, and an empty `berrygems/extensions/hoard-allies/` reads as "half-finished amputation, not stabilized". PROJECT.md AMP-01.         | LOW        | Pure `git rm -r`. No code deps. Depends on: nothing. Dependencies: gates every later milestone — if husks stay, install-smoke may still "work" but the tag lies about the cleanup thesis.        |
| `README.md` that describes the _current_ repo                       | The only user-facing file a first-time installer reads. Today's README still says "Built by a small dog and a large dragon" without mentioning tests, CI, or post-amputation scope — it's from the pre-amputation era. PROJECT.md DOCS-01.          | LOW        | Rewrite, not additive. Must cover: what pantry is (post-amputation), how to `pi install`, what lives in `berrygems/` vs `morsels/`, pointer to AGENTS.md + ETHICS.md, install-smoke claim.       |
| Berrygem inventory in README                                        | `mitsupi/README.md` lists every extension with a one-line description + link. Without this, "what am I installing?" has no answer short of `ls`. PROJECT.md DOCS-02.                                                                                | LOW        | 17 lines. Hand-writable or script-generated from the first JSDoc block of each `index.ts`/`*.ts`. Prefer hand-written for voice consistency; re-generation script is a differentiator, not TS.   |
| Morsel inventory in README                                          | Same rationale as berrygem inventory. Mitsupi does it. Skills are 56 entries — long but not unreasonable if grouped. PROJECT.md DOCS-03.                                                                                                            | LOW        | Group by category (git/github, language, framework, pi-internals, meta, workflow). Can be generated from `SKILL.md` frontmatter `description` field since that's already required content.       |
| Per-berrygem `README.md` for each multi-file directory extension    | `dragon-breath/`, `dragon-guard/`, `dragon-websearch/` carry enough surface area that a first-time reader needs in-situ orientation. Single-file extensions don't need this — JSDoc + inventory line is enough. PROJECT.md DOCS-04 + Key Decisions. | LOW        | `dragon-guard/README.md` already exists. `dragon-breath/` and `dragon-websearch/` need one. Pattern: what it does, how to enable, settings keys, cross-extension deps.                           |
| `LICENSE` file (MIT, committed)                                     | GitHub renders license badge from this file. Current repo has `README.md` stating "MIT" but no `LICENSE` file (verified: `ls LICENSE*` returned empty). Every morsel frontmatter declares `license: MIT` — the repo root must back that claim.      | LOW        | Paste the standard MIT text with copyright line. Not in PROJECT.md Active but implicit in "publish v1.0".                                                                                        |
| `v1.0.0` git tag                                                    | The thesis of this milestone. Without a tag, "publish" has no artifact. PROJECT.md REL-01.                                                                                                                                                          | LOW        | Annotated tag on the commit that completes the Active list. `pi install github:dotBeeps/pantry#v1.0.0` must resolve.                                                                             |
| Passing CI gate on every push to main and on every PR               | "Stabilized" without CI is aspiration, not evidence. PROJECT.md CI-01.                                                                                                                                                                              | MEDIUM     | GitHub Actions, ubuntu-latest, matches Linux-only constraint. Runs `tsc` + Vitest + frontmatter linter + install smoke. See STACK.md for the exact action versions.                              |
| CI status badge in README                                           | First line of a README; signals whether HEAD is green. Expected on any v1.0+ repo with CI. Missing badge with live CI feels like the author is hiding results.                                                                                      | LOW        | One Markdown line under the title. Depends on CI-01 being green.                                                                                                                                 |
| Tests that exist and run                                            | Not "80% coverage", just "a `pnpm test` that executes and passes". Today there are zero `.test.ts` files (per ARCHITECTURE.md). PROJECT.md TEST-01 + TEST-02 + TEST-03.                                                                             | HIGH       | Vitest runner + unit tests for `lib/` (11 modules) + integration tests for extensions via `@marcfargas/pi-test-harness`. STACK.md specifies versions. This is the biggest lift.                  |
| Morsel frontmatter lint                                             | 56 skills with hand-authored YAML — guaranteed drift without a linter. Pi's skill loader tolerates missing fields silently, so breakage is invisible until a skill fails to load at runtime. PROJECT.md TEST-04.                                    | LOW        | `yaml@2.8.3` + `zod@4.3.6` over each `SKILL.md`. Asserts `name` equals directory name + `description` present + `license: MIT` + optional `compatibility` typed correctly.                       |
| Install smoke test                                                  | The unique-to-this-domain gate. Everything else can be green while `pi install` is still broken because a manifest path moved or a symlink vanished. PROJECT.md CI-02.                                                                              | HIGH       | Run `pi install $GITHUB_WORKSPACE` into a tmp `HOME`; assert extensions enumerate + at least one tool call + one skill load succeeds. STACK.md points at `pi-test-harness.verifySandboxInstall`. |
| `AGENTS.md` retained and accurate                                   | Existing grounding doc. Covers layout, verification, conventions. Mitsupi ships one too — this is the expected "how to contribute / how agents should read the repo" surface for agent-content repos.                                               | LOW        | No rewrite needed; spot-check for post-amputation accuracy. Specifically: the "no test framework" line in AGENTS.md becomes a lie once TEST-01 lands. Update in the same PR as TEST-01.          |
| `ETHICS.md` retained                                                | Project-unique but explicitly elevated in AGENTS.md as "not advisory". Removing it would be a statement. Keeping it is the default.                                                                                                                 | LOW        | Zero work.                                                                                                                                                                                       |
| Root `package.json` with `pi.extensions` + `pi.skills` + `keywords` | Pi's discovery contract. Without it, `pi install` sees no content. Already present; flagged for no-regression testing. Adding the `pi-package` keyword (mitsupi does this) is a trivial win for any future search.                                  | LOW        | Add `"keywords": ["pi-package", "pi-extension", "pi-skill"]` and `"repository"` field while near it. Not in PROJECT.md but cheap bundled win.                                                    |

### Differentiators (Competitive Advantage)

These are not expected, not required, and do not appear in PROJECT.md Active. They signal real quality _if_ the effort cost is low enough not to dilute the cleanup thesis. Recommend: keep the list short; ship one or two, defer the rest.

| Feature                                                    | Value Proposition                                                                                                                                                                                                                 | Complexity | Notes / Recommendation                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md` with the v1.0.0 entry                       | Mitsupi ships one. Lets future dot read "what was in 1.0?" without `git log` archaeology. Zero-friction once the amputation commits are already written as the seed history.                                                      | LOW        | **Recommend SHIP.** 30 minutes. Just describe the cleanup cut: what was amputated, what was added (tests, CI, install smoke, frontmatter lint, inventories).                                                                                         |
| Inventory auto-generation script                           | Keeps `README.md` inventory in sync with `berrygems/extensions/**` and `morsels/skills/**` as content shifts. Prevents the "README drifted, nobody noticed" failure mode visible in the current pre-amputation README.            | MEDIUM     | **Recommend DEFER to post-1.0.** Tempting, but writing a code-gen step to solve "37 entries might go stale" is over-engineering for a cleanup milestone. Hand-written in v1.0; revisit if content count grows.                                       |
| Coverage badge / coverage in CI                            | "We tested" becomes "we tested _N%_". Vitest ships `--coverage`. Adds one GHA step.                                                                                                                                               | LOW        | **Recommend DEFER.** Audience is the author. Coverage number is a vanity metric when you know exactly which files are tested. Spend the complexity on actual test quality instead.                                                                   |
| Screenshot / animated-GIF demo of top panels in README     | `dragon-parchment`, `dragon-scroll`, `dragon-guard`, `dragon-herald` have strong visual identities that a static README buries. One GIF per showcase extension would make "what does this _feel_ like" answerable. LazyVim-style. | MEDIUM     | **Recommend SHIP ONE.** Pick `dragon-parchment` (the hub). Record with asciinema or the repo's own animated-image helpers. Defer the other three to later — diminishing returns on the "publish v1.0" thesis.                                        |
| Per-berrygem `AGENTS.md` for the three dir extensions      | `dragon-guard/AGENTS.md` already exists. Bringing `dragon-breath/` and `dragon-websearch/` up to parity establishes the convention for future graduated extensions, per AGENTS.md:238.                                            | LOW        | **Recommend SHIP.** Natural companion to DOCS-04's per-extension READMEs. AGENTS.md documents conventions & antipatterns (agent-facing); README documents usage (human-facing). Different audiences — worth both.                                    |
| GitHub Release with notes at `v1.0.0`                      | The `git tag` is the machine artifact; the GitHub Release is the human one. Free once the tag exists — `gh release create v1.0.0 --notes-from-tag` or paste CHANGELOG's 1.0 section.                                              | LOW        | **Recommend SHIP.** 2 minutes. Closes the "publish" loop cleanly.                                                                                                                                                                                    |
| Architecture overview document (diagram)                   | Pantry's cross-extension `globalThis[Symbol.for(...)]` bus is non-obvious; a diagram would accelerate future agent onboarding.                                                                                                    | MEDIUM     | **Recommend DEFER.** `.planning/codebase/ARCHITECTURE.md` already covers this in prose and is excellent. Diagrams are nice-to-have; they drift fastest. Link to ARCHITECTURE.md from README instead.                                                 |
| Dependabot / Renovate config for CI action versions        | Keeps `actions/checkout@v4` etc. current without babysitting. One `.github/dependabot.yml` file.                                                                                                                                  | LOW        | **Recommend SHIP.** 10 minutes. Weekly schedule, PRs only for CI deps. Audience-aligned (dot doesn't want to hand-bump GHA actions).                                                                                                                 |
| Example `.pi/settings.json` snippet                        | Mitsupi doesn't do this; pantry has a richer settings surface (`pantry.guard.*`, `pantry.tone.*`, etc.) that's currently undocumented outside AGENTS.md's contributor/tone sections.                                              | LOW        | **Recommend DEFER to post-1.0.** Attractive but scope-creepy — once you document three keys, you owe all of them. Ship a pointer ("see `berrygems/lib/settings.ts:76-108` for the legacy key map") and do the full settings doc as a v1.1 milestone. |
| `pi-package` keyword + `repository` in root `package.json` | Listed under Table Stakes above; trivial inclusion. Noted here only to prevent double-counting.                                                                                                                                   | —          | See Table Stakes.                                                                                                                                                                                                                                    |

**Net recommendation for this milestone (differentiators):** Ship `CHANGELOG.md`, per-berrygem `AGENTS.md` for the three dir extensions, GitHub Release, and Dependabot. Defer inventory auto-gen, coverage, screenshots, architecture diagram, and settings reference.

### Anti-Features (Tempting but Explicitly Out of Scope)

Every entry here either traces back to a PROJECT.md Out-of-Scope line or would violate the "cleanup cut, not feature milestone" framing of the Key Decisions table. Recording them explicitly so they don't silently re-enter.

| Feature                                                                      | Why Requested                                                                                                                                       | Why Problematic                                                                                                                                                                                                                                                                                                                 | Alternative                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm publish (`npm publish` + publish workflow)                               | "Mitsupi publishes to npm, so should we." It's the canonical path for library releases.                                                             | **PROJECT.md Out of Scope line 1: "pi's install contract is `pi install <git-url>`; an npm package adds friction without a user."** Audience is dot's machines; she installs by git URL. Publishing to npm obligates semver policy, version-bump discipline, and a token rotation story for zero gain.                          | Keep `pi install github:dotBeeps/pantry` as the only install path. If a second consumer ever appears, revisit.                                                                                                       |
| agentskills.io publication for morsels                                       | The meta-skill `skill-designer` even documents the publishing flow. Morsels are independently consumable; publishing them broadens reach.           | **PROJECT.md Out of Scope line 3: "possible future move; not a goal this milestone."** Same audience argument — adds a release/mirror responsibility without a consumer asking. Morsels are published _implicitly_ via the GitHub install; pi's skill loader doesn't need agentskills.io to find them inside pantry.            | Track as a post-1.0 possibility in PROJECT.md Out of Scope (already there). Revisit when a non-dot consumer requests it.                                                                                             |
| Net-new berrygems or morsels                                                 | "While we're in here, let's add the `dragon-<thing>` I've been wanting." Feature-driven energy feels good during stabilization.                     | **PROJECT.md Out of Scope line 4 + Key Decisions: "cleanup cut, not a feature milestone."** New content widens the test surface, delays CI greenness, and muddies the v1.0 changelog story. The amputation was the _point_ — adding content immediately after amputating undoes the discipline.                                 | Queue new berrygems/morsels as separate `den/features/<name>/` plans. v1.1 is the natural home for them. The empty `berrygems/extensions/hoard-allies/` husk already gets deleted — do not re-populate in its place. |
| Cross-harness adapters (Claude Code plugin parity, Cursor, Codex)            | `morsels/.claude-plugin/plugin.json` exists — extending it to other harnesses would be "free reach".                                                | Adds N CI matrices, N manifests to maintain, N install-smoke paths, and N consumers to care about. The amputation was _toward_ scope narrowing; harness-agnostic claims broaden it. Also: mitsupi doesn't do this either, and mitsupi is the closest analogue we have.                                                          | The existing Claude Code plugin manifest can stay (it's static; zero maintenance cost). Do not extend to other harnesses.                                                                                            |
| Plugin marketplace / discoverability site                                    | "We have 17 extensions + 56 skills, that's more than most pi-packages — surface them."                                                              | Audience is dot. There is no one to discover pantry. This is classic speculative generality; YAGNI.                                                                                                                                                                                                                             | Add `"keywords": ["pi-package"]` to root `package.json` (Table Stakes above) — that's the entire discoverability surface worth building.                                                                             |
| Auto-generated API docs (TypeDoc, etc.)                                      | 11 lib modules with public functions — TypeDoc would render them nicely.                                                                            | Lib modules are internal to extensions (module isolation means no other code can import them anyway — they're not a public API). Generating docs for non-public surface is pure ceremony. TypeDoc output would need hosting, would drift with the code, and would add a third build step to a repo that currently has zero.     | JSDoc comments in `lib/*.ts` remain the contract. Rely on tsserver in-editor hover for discovery. If a lib module ever becomes a public contract to other pi-packages, revisit.                                      |
| macOS / Windows CI matrix                                                    | GitHub Actions makes it one-line to add.                                                                                                            | **PROJECT.md Out of Scope line 5 + Constraints: "Linux-only matches dot's dev environment."** Every added OS multiplies flake risk, install-smoke complexity (kitty protocol detection, fish availability, path assumptions), and maintenance load.                                                                             | `ubuntu-latest` only. Add matrix only when a concrete non-Linux consumer exists.                                                                                                                                     |
| Restoration of amputated scope (daemon, persona, Ember, cc-plugin)           | Some of the amputation husks are still in-tree. "While we're cleaning, we could just fix them instead of deleting."                                 | **PROJECT.md Out of Scope line 0: "amputated on 2026-04-22; those concerns move to separate harness-specific repos."** The amputation commit is a deliberate decision with a tombstone commit (`b9c5050`). Resurrecting scope mid-stabilization nullifies the amputation's thesis and blows v1.0's timeline.                    | Hard delete per AMP-01. If any of those scopes return, they return in different repositories.                                                                                                                        |
| dragon-forge / Ember voice fine-tuning                                       | Listed separately in PROJECT.md and memory.md because it's a frequent temptation.                                                                   | **PROJECT.md Out of Scope line 6: "left the repo in the 2026-04-22 amputation."** See also `~/.claude/projects/-home-dot-Development-pantry/memory/project_ember_finetune.md`.                                                                                                                                                  | Separate repo, separate milestone, not this one.                                                                                                                                                                     |
| Semantic-release / conventional-commit-driven automation                     | Conventional commits are already the project convention (AGENTS.md:255). Automating CHANGELOG + version bump from commits is the natural next step. | Introduces a release bot, a GitHub token with write perms, and a CHANGELOG format that's constrained by commit message parsing. High setup cost, doubtful payoff at one-release-per-milestone cadence. Mitsupi uses a hand-authored `make-release` plumbing command instead — a good tell about the right size for this domain. | Hand-authored `CHANGELOG.md` entries. The tag is cut manually per REL-01. Revisit only if release cadence jumps to >1/month.                                                                                         |
| pnpm workspace / turborepo conversion of the root                            | "berrygems/ has a `package.json`, morsels/ has a `package.json`, root has a `package.json`… this looks like a workspace."                           | Root `package.json` is **a pi-package manifest, not an npm workspace root** (PROJECT.md Constraints). Converting would force npm-workspace resolution semantics that conflict with how pi enumerates `pi.extensions`/`pi.skills` paths. It would also bury the pi manifest under pnpm tooling.                                  | Leave the three-file arrangement exactly as is. Document it explicitly in the new README so no one "cleans it up" later.                                                                                             |
| Removing `berrygems/node_modules/` symlinks from gitignore / committing them | Makes `tsc` work on a fresh clone without the pi install dance.                                                                                     | Symlinks are fragile across OS and point into pi's global npm store — committing them is guaranteed drift. The repair recipe in AGENTS.md:94-102 is the correct answer.                                                                                                                                                         | Keep `node_modules/` gitignored. Add the symlink repair recipe to README.md's "Getting started for contributors" section.                                                                                            |

## Feature Dependencies

```
AMP-01 (remove husks)
    └──precedes──> DOCS-01 (README rewrite — current repo shape must be settled first)
                        └──precedes──> DOCS-02 / DOCS-03 (inventories — README frame must exist)
                                              └──precedes──> DOCS-04 (per-extension READMEs — linked FROM top README)

TEST-01 (Vitest setup)
    └──required-by──> TEST-02 (unit tests need the runner)
    └──required-by──> TEST-03 (integration tests need the runner + pi-test-harness)

TEST-04 (frontmatter lint) is standalone
    └──only needs──> a `pnpm test` script that can invoke it

CI-01 (GHA workflow)
    └──depends-on──> TEST-01 + TEST-04 (nothing to run without them)
    └──depends-on──> AMP-01 (a green CI that still contains husks is misleading)

CI-02 (install smoke)
    └──depends-on──> AMP-01 (smoke asserts extension count — husks would skew)
    └──depends-on──> CI-01 (runs inside the same workflow)

LICENSE file is standalone (independent of everything; do it first as a freebie)

REL-01 (tag v1.0.0)
    └──requires──> every Active requirement green (PROJECT.md: "once every Active requirement above is green")

CHANGELOG.md (differentiator)
    └──enhances──> REL-01 (tag message can reference the changelog)

Per-berrygem AGENTS.md (differentiator)
    └──parallel-with──> DOCS-04 (same PR per extension makes sense)

GitHub Release (differentiator)
    └──depends-on──> REL-01 + CHANGELOG.md

Dependabot config (differentiator)
    └──depends-on──> CI-01 (nothing to bump until actions are in use)
```

### Dependency Notes

- **AMP-01 must land first.** Every later requirement either reads the tree (README, inventory) or runs against it (CI, install smoke). Doing AMP-01 after DOCS-01 means rewriting the README twice.
- **TEST-01 unlocks the two test requirements.** TEST-02 and TEST-03 are independent of each other once the runner exists; they can land in separate PRs in parallel.
- **TEST-04 is fully independent** of the Vitest setup — it can be a tiny standalone script that Vitest merely _invokes_ (`describe('frontmatter', () => { for (const skill of walkSkills()) ... })`) or a completely separate `node --experimental-strip-types scripts/lint-frontmatter.ts`. Choose the Vitest-integrated path for a single `pnpm test` entry point.
- **CI-02 (install smoke) is the riskiest gate.** It's the only gate that can pass locally but fail in CI because of environment differences (symlinks, `HOME`, fish-vs-bash, pi's global cache). Budget debugging time. STACK.md's recommendation to reuse `pi-test-harness.verifySandboxInstall` is what makes this feasible within the milestone scope.
- **REL-01 is a gate, not a feature.** It's the milestone complete trigger; don't over-think it as a discrete unit of work. A proper `git tag -a v1.0.0 -m "…" && gh release create v1.0.0` is ~2 minutes once the rest is green.

## MVP Definition

### Launch With (v1.0)

The strict-minimum list — reject anything that isn't grounded in PROJECT.md Active or directly rendered invalid by its absence.

- [ ] **AMP-01** — Husks deleted. Without this, the tag is dishonest about what "stabilized" means.
- [ ] **TEST-01 + TEST-02 + TEST-03** — Vitest runner + lib unit tests + extension integration tests. Without these, "stabilized" is aspiration.
- [ ] **TEST-04** — Morsel frontmatter lint. Without it, 56 skills can silently drift.
- [ ] **CI-01** — GitHub Actions workflow passing on main and PRs. Without it, green tests are unproven at HEAD.
- [ ] **CI-02** — Install smoke test. The only gate that catches the manifest/symlink/pi-contract failure class. The unique-to-this-domain signal.
- [ ] **DOCS-01** — Rewritten README reflecting the post-amputation repo. Without it, first-time install reads pre-amputation fiction.
- [ ] **DOCS-02 + DOCS-03** — Berrygem + morsel inventories in README. Mitsupi-parity baseline.
- [ ] **DOCS-04** — Per-dir-extension READMEs (dragon-breath, dragon-guard already has one, dragon-websearch).
- [ ] **LICENSE file** — MIT text committed at root (Table Stakes; absent today).
- [ ] **REL-01** — `v1.0.0` annotated tag.

### Add After Validation (v1.0.x / v1.1)

Ship these as differentiators alongside or immediately after v1.0 if time permits; do not block the tag on them.

- [ ] **CHANGELOG.md** — Seed with the v1.0.0 entry. (~30 min; recommend bundling with REL-01.)
- [ ] **GitHub Release at v1.0.0** — ~2 min once tag exists.
- [ ] **Per-berrygem `AGENTS.md`** for `dragon-breath/` and `dragon-websearch/` — parity with `dragon-guard/AGENTS.md`.
- [ ] **Dependabot config** for GHA action bumps — set-and-forget.
- [ ] **`pi-package` keyword + `repository` field** in root `package.json` — trivial.
- [ ] **One demo GIF** of `dragon-parchment` in the README — the visual anchor for "what does this feel like".

### Future Consideration (v2+ / explicitly-deferred)

- [ ] Inventory auto-generation from extension JSDoc / skill frontmatter — revisit if content count keeps growing or README drift is observed.
- [ ] Full settings reference document — blocks on wanting to formalize the `pantry.*` schema.
- [ ] Additional demo GIFs for `dragon-scroll`, `dragon-guard`, `dragon-herald`.
- [ ] Architecture diagram rendered to SVG — ARCHITECTURE.md already covers this in prose.
- [ ] `CONTRIBUTING.md` — unneeded until there's a non-dot contributor.

**Deliberately kept in Out-of-Scope indefinitely:** everything in PROJECT.md's Out of Scope block (npm publish, agentskills.io, net-new content, cross-OS CI, amputated-scope restoration, dragon-forge).

## Feature Prioritization Matrix

| Feature                                    | User Value | Implementation Cost | Priority |
| ------------------------------------------ | ---------- | ------------------- | -------- |
| AMP-01 husk removal                        | HIGH       | LOW                 | P1       |
| DOCS-01 README rewrite                     | HIGH       | LOW                 | P1       |
| DOCS-02 berrygem inventory                 | HIGH       | LOW                 | P1       |
| DOCS-03 morsel inventory                   | HIGH       | LOW                 | P1       |
| DOCS-04 per-dir-extension README           | MEDIUM     | LOW                 | P1       |
| LICENSE file                               | HIGH       | LOW                 | P1       |
| TEST-01 Vitest setup                       | HIGH       | MEDIUM              | P1       |
| TEST-02 lib unit tests                     | HIGH       | MEDIUM              | P1       |
| TEST-03 extension integration              | HIGH       | HIGH                | P1       |
| TEST-04 frontmatter lint                   | HIGH       | LOW                 | P1       |
| CI-01 GHA workflow                         | HIGH       | MEDIUM              | P1       |
| CI-02 install smoke                        | HIGH       | HIGH                | P1       |
| CI badge in README                         | MEDIUM     | LOW                 | P1       |
| REL-01 v1.0.0 tag                          | HIGH       | LOW                 | P1       |
| CHANGELOG.md                               | MEDIUM     | LOW                 | P2       |
| GitHub Release                             | MEDIUM     | LOW                 | P2       |
| Per-berrygem AGENTS.md (breath, websearch) | MEDIUM     | LOW                 | P2       |
| Dependabot for CI actions                  | MEDIUM     | LOW                 | P2       |
| `pi-package` keyword + `repository` field  | LOW        | LOW                 | P2       |
| One demo GIF (dragon-parchment)            | MEDIUM     | MEDIUM              | P2       |
| Coverage reporting in CI                   | LOW        | LOW                 | P3       |
| Inventory auto-gen script                  | LOW        | MEDIUM              | P3       |
| Architecture diagram                       | LOW        | MEDIUM              | P3       |
| Full settings reference doc                | MEDIUM     | HIGH                | P3       |
| CONTRIBUTING.md                            | LOW        | LOW                 | P3       |

**Priority key:**

- **P1** — Must ship for v1.0.0 tag (Table Stakes, grounded in PROJECT.md Active).
- **P2** — Should ship alongside or immediately after v1.0.0 (selected differentiators, low cost).
- **P3** — Defer to post-1.0; revisit on a later milestone with a concrete trigger.

## Competitor / Analogue Feature Analysis

| Feature                          | `mitsupi` (mitsuhiko/agent-stuff)                          | VS Code extension packs     | Dotfiles monorepos (typical)    | **Pantry v1.0 plan**                                                |
| -------------------------------- | ---------------------------------------------------------- | --------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| README with inventory            | ✓ (skills + extensions + themes + distributions, bulleted) | ✓ (bundled extensions list) | ✓ (install steps + module list) | ✓ (DOCS-01 + DOCS-02 + DOCS-03) — mitsupi-parity by design          |
| `CHANGELOG.md`                   | ✓                                                          | Usually                     | Rare                            | ✓ as P2 differentiator                                              |
| `LICENSE` file                   | ✓                                                          | ✓                           | ✓                               | ✓ as P1 (absent today)                                              |
| `AGENTS.md` / contributor doc    | ✓                                                          | Rare                        | Sometimes                       | ✓ already present; retained                                         |
| CI                               | Not visible in installed package                           | Marketplace handles build   | Usually Ubuntu install-smoke    | ✓ (CI-01 + CI-02) — _above_ mitsupi's baseline, which is deliberate |
| Tests                            | Not visible                                                | Per-extension               | Rare                            | ✓ (TEST-01/02/03/04) — _above_ baseline, deliberate                 |
| Install smoke test               | None visible                                               | Marketplace validates       | `install.sh` smoke in CI        | ✓ (CI-02) — unique-to-domain gate                                   |
| Frontmatter / manifest lint      | Not present                                                | N/A                         | N/A                             | ✓ (TEST-04)                                                         |
| Version tag / GitHub Release     | ✓ (npm versioned)                                          | ✓                           | Sometimes                       | ✓ (REL-01 + P2 Release)                                             |
| npm publish                      | ✓                                                          | ✓                           | No                              | ✗ **Out of Scope** — PROJECT.md explicit                            |
| Public registry (agentskills.io) | Partial (skills are on the skills index)                   | Marketplace                 | N/A                             | ✗ **Out of Scope** — PROJECT.md explicit                            |
| Auto-gen API docs                | No                                                         | No                          | No                              | ✗ Anti-feature                                                      |
| Cross-OS CI matrix               | Unknown                                                    | Marketplace handles         | Sometimes                       | ✗ **Out of Scope** — Linux-only per PROJECT.md Constraints          |

**Key insight from the analogue table:** pantry's v1.0 plan is _deliberately stricter_ than `mitsupi` on CI + tests + install smoke, and _deliberately looser_ on publication (no npm, no agentskills.io). That's a coherent stance: the author values reproducible-install confidence more than reach.

## Sources

- [`mitsupi` / `mitsuhiko/agent-stuff` README](https://github.com/mitsuhiko/agent-stuff) — inspected locally at `/home/dot/.npm/lib/node_modules/mitsupi/` (README, package.json, top-level layout). HIGH confidence — this is the closest analogue authored by one of pi's inner-circle users.
- [`badlogic/pi-mono` packages docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md) — pi-package format contract, keyword convention, `pi.extensions`/`pi.skills`/`pi.prompts`/`pi.themes` manifest shape. HIGH confidence.
- [`badlogic/pi-mono` package management](https://deepwiki.com/badlogic/pi-mono/4.12-model-configuration-and-selection) — install semantics, auto-discovery fallback when no `pi` manifest is present.
- PROJECT.md (local) — canonical source for Active, Out of Scope, Constraints, and Key Decisions. HIGH confidence, primary input.
- `.planning/codebase/ARCHITECTURE.md` + `.planning/codebase/STRUCTURE.md` (local) — current repo shape, shipped vs non-shipped directories, amputation remnants.
- `.planning/research/STACK.md` (local) — paired research output; Table Stakes reference its tool choices (Vitest, pi-test-harness, yaml+zod, GHA v4 actions).
- VS Code extension-pack and dotfiles-monorepo conventions — general-industry baseline ([mattorb on dotfile CI smoke](https://mattorb.com/ci-your-dotfiles-with-github-actions/), [Lunkentuss/dotfiles](https://github.com/Lunkentuss/dotfiles), [niqodea/.dev-environment](https://github.com/niqodea/.dev-environment)). MEDIUM confidence — general patterns, not pi-specific.

---

_Feature research for: pi-package v1.0 stabilization_
_Researched: 2026-04-22_
