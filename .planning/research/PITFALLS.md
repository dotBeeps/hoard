# Pitfalls Research

**Domain:** Stabilization + v1.0 tag of a pi-package monorepo (jiti-loaded TS extensions + Markdown skills) post-amputation, GitHub-install-only, no existing test or CI infrastructure.
**Researched:** 2026-04-22
**Confidence:** HIGH for amputation-residue, module-isolation, and frontmatter-lint pitfalls (grounded in CONCERNS.md + ARCHITECTURE.md + FEATURES.md for this exact tree). HIGH for jiti/native-Node-TS pitfalls (verified against vitest 4 docs + pi's loader behaviour). MEDIUM for GitHub-install distribution pitfalls (derived from pi's install-contract shape; no pantry-specific post-mortem yet because v1.0 hasn't shipped).

## Framing

Generic "write better tests" advice is useless here. The pitfalls below are the ones that will actually land on pantry's v1.0 and post-1.0 roadmap because of its specific shape:

1. The repo was just amputated — there's known residue (CONCERNS.md enumerates 495 `hoard` matches).
2. Pi loads each extension in its own jiti module context — Node's module cache will lie to tests.
3. Cross-extension APIs are `globalThis[Symbol.for(...)]` strings — refactors silently miss call sites.
4. YAML frontmatter is the morsel's contract — no runtime enforces it.
5. Distribution is `pi install github:...` — every `main` push is a release for every consumer.
6. The one automated gate today (tsc) is currently red (dragon-breath import path, per CONCERNS.md Known Bugs).

All pitfalls below tie back to one of those six shapes. The phase names use the roadmap's current vocabulary — **AMP** (amputation cleanup), **TEST** (test infrastructure), **CI** (GitHub Actions), **DOCS** (README/inventories), **REL** (v1.0 tag).

---

## Critical Pitfalls

### Pitfall 1: Amputation-residue strings teach agents to call dead APIs

**What goes wrong:**
`morsels/skills/hoard-allies/SKILL.md:295` documents `Symbol.for("hoard.allies")` as the consumer key. `morsels/skills/hoard-sending-stone/SKILL.md:17,123` documents `Symbol.for("hoard.stone")`. Berrygems publish under `pantry.*` now, so any agent that loads one of these skills and follows the example gets `undefined` from the global bus — silently. No error, no log, no crash. The extension just no-ops.

**Why it happens:**
Rename surgery touched ~18 `Symbol.for` keys and ~60 call sites in berrygems code (per CONCERNS.md). `grep -r hoard` across the repo hits 495 matches; most are planning archives but several dozen are in _live, shipped_ skill bodies and code comments. The amputation commit (`b9c5050`) is atomic for disk state but the string-rename is cosmetic — nothing enforces string consistency.

**How to avoid:**
Inventory every `Symbol.for("hoard.*")` and every `HOARD_*` env-var documented in `morsels/skills/**/SKILL.md` and `berrygems/**/*.ts` before writing new tests. The two skill files at `morsels/skills/hoard-allies/` and `morsels/skills/hoard-sending-stone/` document amputated subsystems entirely — they should be _deleted_, not renamed. Delete-outright is the correct fix for any content whose underlying berrygem is amputated. For content that describes surviving APIs, do a mechanical `hoard.` → `pantry.` rewrite with a follow-up `rg '\bhoard\b'` sweep excluding `den/`/`.git`/`node_modules`/`.planning`.

Write a lint rule (can piggyback on TEST-04) that rejects any `Symbol.for("hoard.*")` string literal in either `berrygems/` or `morsels/`. This prevents regression during future amputation-style surgery.

**Warning signs:**

- `rg 'Symbol\.for\("hoard\.' morsels berrygems` returns any results.
- `rg 'HOARD_[A-Z_]+' morsels berrygems` returns any env-var references.
- Any skill's body contains code examples with `hoard.*` keys.
- A `grep -c hoard .planning/codebase/CONCERNS.md` yielding >20 after AMP phase — the audit file should empty out as these are fixed.

**Phase to address:**
**AMP** — before TEST, before CI, before DOCS. Must land first because tests and docs reference the same surface; fixing residue _after_ writing tests against a clean surface means tests pass while docs lie.

---

### Pitfall 2: Node module cache makes tests pass that would fail under pi's jiti loader

**What goes wrong:**
Vitest (and any Node-native test runner) caches modules by absolute path. Import a berrygem's module twice in a test suite and you get the same instance — shared mutable state, shared registered `globalThis` symbols, shared settings cache in `lib/settings.ts`. But pi loads each extension in its own jiti context — each gets a fresh module. Tests that exercise publisher+consumer interaction (`dragon-parchment` publishes `pantry.parchment`, `dragon-scroll` consumes it) will pass because Node's cache lets both files see the same `globalThis`. In production they see isolated contexts and the `Symbol.for` bus is the only bridge — but the tests never exercised the bus because they skipped straight to the shared module reference.

The worst failure mode: a publisher that _forgets_ to publish its API on `globalThis` still appears to work in tests because consumers imported it directly.

**Why it happens:**
`@marcfargas/pi-test-harness` exists specifically because hand-rolled test setups get this wrong. But it's tempting to write a unit test that does `import { createPanel } from "../extensions/dragon-parchment"` and asserts on the function directly — that is not what pi sees at runtime.

**How to avoid:**

- Every berrygem integration test (TEST-03) goes through `@marcfargas/pi-test-harness`'s `createTestSession`, not direct imports. The harness loads extensions the way pi does.
- Unit tests in `berrygems/lib/` are fine with direct imports — `lib/` is imported across extensions by design, it's the _extensions_ that isolate.
- Add a smoke-test pattern: each extension's integration test must (a) spin a fresh `createTestSession`, (b) load the extension, (c) assert the expected `Symbol.for("pantry.<name>")` key is populated on `globalThis`. If a publisher regresses and stops populating the key, that's a one-line test that catches it.
- Write one explicit "two extensions, one session" test that loads publisher + consumer and exercises the `globalThis` round-trip. That test's failure mode is the canary for module-isolation regressions.

**Warning signs:**

- An integration test imports from `../extensions/dragon-*` directly.
- A test passes locally but fails under `verifySandboxInstall` in CI.
- A test mutates module-level state (e.g. a `Map` at file scope in an extension) and a later test depends on that mutation.

**Phase to address:**
**TEST** — specifically TEST-01 config setup (enforce the "no direct extension imports in integration tests" convention) and TEST-03 (harness-first test authoring).

---

### Pitfall 3: Cross-extension `Symbol.for` key drift (the pattern just burned us)

**What goes wrong:**
Three morsels (`hoard-allies/SKILL.md`, `hoard-sending-stone/SKILL.md` × 2 occurrences) survived the `hoard.*` → `pantry.*` rename with stale keys. There is no compile-time or runtime check that a key string in a morsel example matches any actual publisher. The next rename will repeat the miss. CONCERNS.md §Symbolic-key string drift calls this out explicitly: 18 keys renamed, 3 missed, and "the consumer just gets `undefined` and quietly no-ops."

**Why it happens:**
The key is a string literal scattered across ~16 publisher + consumer sites plus an unknown number of morsel documentation sites. String literals are invisible to `tsc`. There's no central registry. The `satisfies` operator doesn't help — the expression `(globalThis as any)[Symbol.for("pantry.parchment")]` has `any` type by design for the dynamic-dispatch pattern.

**How to avoid:**
Centralize the keys. Add `berrygems/lib/globals.ts`:

```typescript
export const PANTRY_KEYS = {
  parchment: Symbol.for("pantry.parchment"),
  kitty: Symbol.for("pantry.kitty"),
  breath: Symbol.for("pantry.breath"),
  imageFetch: Symbol.for("pantry.imageFetch"),
  lab: Symbol.for("pantry.lab"),
} as const;
```

Extensions import `PANTRY_KEYS.parchment` instead of repeating the string. A rename becomes a one-file edit + `tsc` failure at every usage site. Morsels document the constant name (and copy the string _from_ the constant when they need to surface it to agents).

Additionally: the TEST-04 frontmatter linter should be extended to lint skill _bodies_ for `Symbol.for("pantry.<name>")` strings, with the list of valid names sourced from `lib/globals.ts`. Any skill referencing an unregistered key fails the lint. This catches documentation drift the moment it lands.

**Warning signs:**

- A `Symbol.for("pantry.*")` string literal appears outside `lib/globals.ts` in `berrygems/`.
- A morsel references a `pantry.*` key that isn't exported from `lib/globals.ts`.
- A `globalThis[Symbol.for("...")]` read returns `undefined` in manual `/reload` testing despite the publisher being loaded.

**Phase to address:**
**AMP** (centralize keys while cleaning) + **TEST** (extend TEST-04 to cover body references). The constants file is a small refactor that belongs in the cleanup milestone; lint coverage rides along with the linter being written anyway.

---

### Pitfall 4: Frontmatter schema relaxes over time until lint is a no-op

**What goes wrong:**
TEST-04 lands with a strict Zod schema enforcing `name`, `description`, `license: MIT`, optional typed `compatibility`. Six months later someone authors a morsel with a typo in `description`, the lint fails, and the quickest fix is "make the field optional." Two months after that `compatibility` is a free-form string instead of an enum. A year in, the linter permits everything the existing 56 skills have ever contained — it's vendored the drift instead of preventing it.

This is the classic schema-linter half-life problem, made worse here because the _consumer_ (pi's skill loader) is itself tolerant — it silently ignores unknown fields and missing-but-declared-optional fields. So lint relaxation has no runtime symptom. The skills "still work" under pi.

**Why it happens:**
The fix-the-schema path is always cheaper than fix-the-content path in the moment. Without a policy, each individual relaxation is locally reasonable.

**How to avoid:**

- Write down the policy in `morsels/AGENTS.md`: "The frontmatter schema is a contract, not a snapshot. If an existing skill would fail a proposed schema, fix the skill, don't loosen the schema."
- Reify the schema as Zod in a single file (`morsels/scripts/schema.ts`), exported. Any loosening is a diff on that file — visible in review.
- Emit a JSON Schema dump alongside (`z.toJSONSchema()` — Zod 4 native) and commit it at `morsels/schema/skill-frontmatter.json`. Human review of a .json change is more suspicious than a .ts change; the dual-format commit is a trip wire.
- Consider an allowlist regression test: "The schema parses every existing `morsels/skills/*/SKILL.md`." This test _failing_ when the schema is tightened is expected; the failure message must point at the _skill_ that needs fixing, not the schema.

**Warning signs:**

- A PR adds `.optional()` to a previously-required Zod field without also adding a test that asserts the field is still required for skills above some cutoff.
- The `zod` schema accepts `z.string()` where a previous version had `z.enum([...])`.
- A new skill is merged with a `description` > 1024 chars (the documented cap) and the lint didn't catch it — means the length check isn't wired.
- The committed `morsels/schema/skill-frontmatter.json` hasn't changed in six months despite morsel churn.

**Phase to address:**
**TEST** (TEST-04 writes the schema with explicit required fields, all enums typed, max lengths enforced) + **DOCS** (write the non-loosening policy into `morsels/AGENTS.md` in the same PR as the linter).

---

### Pitfall 5: Install smoke passes because it tests what it shouldn't

**What goes wrong:**
CI-02 calls `pi-test-harness.verifySandboxInstall` which does `npm pack` → `npm install <tarball>` → loads extensions. That validates _manifest discovery_ and _extension load_. But pi's actual install contract is `pi install github:dotBeeps/pantry` — a git-clone path that pulls the repo fresh, not an npm-pack. The two codepaths diverge on: (a) how `berrygems/node_modules/` symlinks are resolved (npm-pack includes them and breaks them; git-clone needs them re-linked via pi), (b) how workspace-adjacent files are included (npm honours `files`/`.npmignore`; git-clone takes everything tracked), (c) what the `HOME` directory looks like when pi writes its cache.

A smoke test that asserts "extensions load after npm-pack install" can be green while `pi install github:...` is red. The first consumer bug report is the signal.

Worse — the harness might silently handle a case pi's production loader doesn't, if the harness version gates ahead of pi's released version.

**Why it happens:**
`npm pack` is cheap and deterministic; git-install-in-tmp-HOME is slow and fiddly. The easy test gets written; the hard one gets deferred. The STACK.md recommendation is honest about this — it suggests a _two-step_ smoke (harness first for speed, then a real `pi install` step against `$GITHUB_WORKSPACE` into a fresh `HOME=$(mktemp -d)`).

**How to avoid:**

- Implement both gates, not just the harness gate. The fast one runs on every push; the realistic one runs on every push too (ubuntu-latest is cheap).
- The realistic step: `HOME=$(mktemp -d) pi install $GITHUB_WORKSPACE && HOME=$SAME_TMP pi list` — then grep for expected extension count ≥ 17 and skill count ≥ 56.
- Assert _specific_ known-good content: "extension named `dragon-parchment` is loaded", "skill named `git` exists". Count-based assertions pass if a berrygem renames during the PR — that's a false green.
- Verify `berrygems/node_modules/` is in `.gitignore` AND that `pi install` creates the symlinks fresh. If the smoke test passes because the committed symlinks accidentally survived, you're not testing pi's install path.

**Warning signs:**

- The CI workflow has only one install step and it's the harness `verifySandboxInstall`.
- The smoke test asserts on count (`extensions.length === 17`) instead of specific names.
- Local `pi install /path/to/pantry` works for dot but a fresh clone's CI doesn't (or vice-versa) — means the tests aren't gating the same codepath the user hits.
- A PR renames a berrygem file, CI stays green, `/reload` in pi breaks.

**Phase to address:**
**CI** (CI-02 must include both the harness smoke AND the `pi install $GITHUB_WORKSPACE` step). Don't cut the milestone on just the harness one — it's necessary but insufficient for this distribution model.

---

### Pitfall 6: Every push to `main` is a breaking release for every consumer

**What goes wrong:**
The install contract is `pi install github:dotBeeps/pantry`. Without a ref in that URL, pi resolves to `HEAD` of the default branch. Every merge to `main` is live for every machine that runs `pi install` next — no semver buffer, no release train, no deprecation window. A breaking rename to `pantry.parchment` lands at 14:00; by 14:05 every `pi install github:...` on any machine that re-runs the install pulls the break.

For pantry v1.0's narrow audience (dot's machines) this is _mostly_ fine — dot controls when her machines re-run `pi install`. But (a) the audience claim is aspirationally single-user, the GitHub URL is public, (b) CI itself does a smoke install on every PR against `main` — if `main` is broken, every PR's CI is broken until someone fixes `main`.

**Why it happens:**
The absence of `npm publish` (explicitly Out of Scope per PROJECT.md) removes the version-gate that would normally sit between "commit to main" and "consumers see it." The tag exists but `pi install` doesn't use it by default; you have to write `pi install github:dotBeeps/pantry#v1.0.0` to pin.

**How to avoid:**

- Document in README.md the two install flavours: `pi install github:dotBeeps/pantry` (tracks main — fast-moving) versus `pi install github:dotBeeps/pantry#v1.0.0` (pinned — stable). Put the pinned one first under "Recommended install" so anyone copying the README lands on a pinned version.
- Add a `release` branch pointing at the latest tagged commit. `pi install github:dotBeeps/pantry#release` resolves to the last stable point. This gives a pi-side convention without needing npm.
- Protect `main` in GitHub settings: require CI green + one approval before merge. Not to bikeshed process — to make it impossible to ship `main` breakage as fast as a commit.
- On breaking changes (rename of a `Symbol.for("pantry.*")` key, removal of a morsel, removal of a berrygem extension): bump the tag _before_ merging to main. The tag is a rollback anchor for consumers.

**Warning signs:**

- README.md's top-level install instruction lacks a `#v1.x.x` ref.
- No `release` branch exists (or it exists but points at `main`).
- `main` protection is off on GitHub.
- A breaking change landed on `main` with no tag bump (the `b9c5050` amputation commit itself is a `chore!:` commit — the `!` marks breakage — but there's no pre-amputation tag to roll back to).

**Phase to address:**
**REL** — document the install flavours in the v1.0.0 README (DOCS-01) and cut the tag (REL-01) AT the v1.0 commit. Add the `release` branch at the tag. Protect `main` before the tag cut. This is a policy layer on top of the existing DOCS+REL requirements — it doesn't add a separate work item, but it does expand what DOCS-01 must cover.

---

### Pitfall 7: `tsc` passes but jiti refuses to load the module

**What goes wrong:**
`berrygems/tsconfig.json` has `allowImportingTsExtensions: true` and `noEmit: true`. `tsc` is type-checking only. The currently-red `tsc` failure (CONCERNS.md Known Bugs: `dragon-breath/index.ts:20` imports `../lib/settings.ts` — should be `../../lib/settings.ts`) is the exact shape of this pitfall already landed. `tsc` _does_ catch that one, but there's a class of jiti-specific load failures `tsc` doesn't catch:

- ESM-specific import assertions (`import x from "./y.json" with { type: "json" }`) that work at runtime but tsc evaluates based on `moduleResolution` settings.
- Circular imports between `lib/` modules that tsc resolves topologically but jiti serializes differently, causing undefined exports at first access.
- Dynamic imports where the path is computed and tsc can't verify, but jiti errors at runtime.
- `import.meta.url` usage that behaves differently under jiti's wrapper than Node's native ESM.

CONCERNS.md also notes: `tsc --project berrygems/tsconfig.json` _itself_ is currently red, meaning the documented automated gate is bypassed by anyone committing. There's nothing preventing merges right now.

**Why it happens:**
Pi loads via jiti, not via compiled JS. `tsc --noEmit` is a static typecheck — jiti is a runtime loader. Their error classes overlap but don't equal.

**How to avoid:**

- Fix `berrygems/extensions/dragon-breath/index.ts:20` import path first — it's blocking the one working gate. This must land in AMP phase or the entire milestone is built on a broken foundation.
- Add a CI step that _actually executes_ each extension's default export against a stub `ExtensionAPI`, via the pi-test-harness. This catches jiti-specific load failures that tsc misses.
- The install smoke (CI-02) is a second-level gate for the same concern — if pi can't load an extension, the count assertion fails.
- Make tsc green a required status check on GitHub branch protection. Without enforcement, the "one automated gate" is just a suggestion.

**Warning signs:**

- `tsc --project berrygems/tsconfig.json` returns any errors. (Currently true — see CONCERNS.md Known Bugs.)
- A commit lands with "tsc errors are pre-existing" as the justification for not fixing them.
- An extension works in pi but tsc errors in CI (rare; usually the opposite direction).
- `import` paths in extensions that traverse `..` a different number of times than their siblings (dragon-breath has `../lib/settings.ts` while dragon-guard has `../../lib/settings.ts` — inconsistency is a red flag even when both happen to work).

**Phase to address:**
**AMP** (fix the current red-tsc bug immediately — it's prerequisite for everything) + **CI** (CI-01 must gate on tsc + actual-load-via-harness, not just tsc alone) + branch protection (REL phase — enforce the gates before cutting v1.0.0).

---

### Pitfall 8: Orphaned `.claude/` and `AGENTS.override.md` hooks fail silently

**What goes wrong:**
CONCERNS.md §`.claude/ config pointing at /home/dot/Development/hoard/` enumerates: `.claude/settings.json` PreToolUse + three Stop hooks all hard-coded to `/home/dot/Development/hoard/.claude/hooks/*.fish` (non-existent path now). `.claude/agents/soul-reviewer.md` reads `/home/dot/Development/hoard/ETHICS.md`. `.claude/skills/hoard-verify/SKILL.md` invokes `/home/dot/Development/hoard/storybook-daemon` and `/home/dot/Development/hoard/psi/qml/...` (both amputated). `.claude/parity-map.json` (147 lines) describes the amputated `cc-plugin/` package — every entry is dangling.

These silently fail on every Claude Code session. The Stop hooks in particular are designed to be advisory — their failure is invisible by design. An agent's "did the session finish cleanly?" check is perpetually broken.

This isn't _pantry runtime_ — pi doesn't load `.claude/`. But it's part of the agent-authoring experience that pantry maintainers use, and leaving it half-migrated is actively harmful per CONCERNS.md. It's also the _easiest kind_ of amputation residue to miss because it fails silently on every session but breaks no shipped code.

**Why it happens:**
The amputation was surgical on pi-package content (`storybook-daemon/`, `psi/`, etc.) but not on developer-tooling surfaces (`.claude/`, `AGENTS.override.md`). These latter surfaces aren't loaded by pi, so CONCERNS.md's "will mis-route" taxonomy didn't flag them as urgent — but they're authoring-environment infrastructure, and agents working on pantry hit them every session.

**How to avoid:**

- `rg '/home/dot/Development/hoard/' .claude AGENTS.override.md` and sweep-replace to `/home/dot/Development/pantry/`.
- Delete `.claude/agents/soul-reviewer.md` outright — its subject (the soul-review subsystem) is amputated. Per CONCERNS.md §Dead import paths in soul-reviewer.
- Delete `.claude/skills/hoard-verify/SKILL.md` — both targets (`storybook-daemon`, `psi/`) are amputated.
- Delete or rewrite `.claude/parity-map.json` — it describes a dead parity surface. If nothing parity-checks pantry to another repo now, the file has no job.
- Audit `.claude/hooks/*.fish` bodies: `stop-doc-sync.fish:140-182` hard-codes `hoard_prefixes`, `hoard_missing`, `hoard:ally-*` patterns. Even with correct paths, the logic scans for a retired namespace.

**Warning signs:**

- `rg '/home/dot/Development/hoard/' .claude AGENTS.override.md` returns any matches.
- Claude Code sessions show PreToolUse/Stop hook errors in the output (these are silent by default — need to explicitly check).
- A `.claude/agents/*.md` file describes a subsystem not mentioned in `ARCHITECTURE.md`.
- `.claude/parity-map.json` contains keys not backed by any live extension/skill/subagent.

**Phase to address:**
**AMP** — bundles with the husk deletion. Same scope ("delete what references amputated subsystems"), same PR makes sense.

---

### Pitfall 9: README inventory diverges from filesystem after the first new extension

**What goes wrong:**
DOCS-02 hand-writes the 17-berrygem inventory. DOCS-03 hand-writes the 56-morsel inventory. v1.0.0 ships with perfect inventory. Three weeks post-1.0, someone adds `dragon-newthing.ts`. They forget to update the README inventory. Six months in, the README lists 17 extensions, the filesystem has 22, and nobody notices because nobody reads the README when they already have pantry installed.

The FEATURES.md research explicitly flagged this as the failure mode for hand-written inventories — and explicitly recommended _deferring_ the auto-gen script to post-1.0, on the reasoning that auto-gen is scope-creep for a cleanup milestone. That's a correct call for v1.0 but the resulting drift is a real cost, not a hypothetical one.

**Why it happens:**
Hand-written inventories require manual attention on every content PR. Without a CI check, attention lapses are invisible. The agent writing the PR sees their one new file; they don't see the 17 that are already in the README.

**How to avoid:**

- v1.0.0 ships hand-written inventories (per FEATURES.md recommendation — don't scope-creep).
- v1.0.0 also ships a `scripts/check-inventory.ts` that `ls`-enumerates `berrygems/extensions/*.ts` and `berrygems/extensions/*/index.ts`, parses README.md's berrygem inventory section (delimited by HTML comment markers: `<!-- berrygem-inventory-start -->` / `<!-- berrygem-inventory-end -->`), and asserts one-to-one match. Same for morsels.
- The check is a Vitest test in the TEST suite. It doesn't generate the inventory, it just asserts the hand-written one is complete. Cheap to write (~40 lines), prevents the drift, keeps hand-written voice.
- If the inventory auto-gen script is ever written (v1.1+), the completeness check is already the contract it satisfies.

**Warning signs:**

- `ls berrygems/extensions/ | wc -l` doesn't match the number of bullets in README.md's berrygem inventory.
- `find morsels/skills -name SKILL.md | wc -l` doesn't match the morsel count in README.md.
- The last commit touching README.md's inventory section is older than the last commit adding a berrygem or morsel.

**Phase to address:**
**DOCS** (DOCS-02 + DOCS-03 hand-write the inventory) + **TEST** (add the completeness check alongside TEST-04 frontmatter lint — same `scripts/` directory, same invocation pattern).

---

### Pitfall 10: "While I'm here" scope creep during cleanup

**What goes wrong:**
AMP-01 deletes amputation husks. Someone notices `dragon-digestion.ts` is 3155 lines (per CONCERNS.md — 10x the documented split threshold). "While I'm here, let me split it." Now the v1.0 milestone includes a 2000-line refactor of the biggest extension in the codebase. The refactor has no tests (TEST-01/02/03 haven't landed yet). The refactor introduces subtle bugs. The milestone blows past its timeline. Someone proposes deferring the tests "because the refactor is the bigger win."

This is the classic cleanup-milestone failure mode: quality-improvement energy finds bigger targets than the milestone scoped. PROJECT.md Key Decisions _explicitly_ calls this out: "cleanup cut, not a feature milestone." FEATURES.md §Anti-Features lists "Restoration of amputated scope" and "Net-new berrygems or morsels" both as out-of-scope for this reason.

The specific targets most likely to be swept up:

- Splitting `dragon-digestion.ts` (3155 lines) and other oversized extensions (CONCERNS.md §Oversized extension files lists nine).
- Removing the `dotsPiEnhancements.*` legacy settings namespace (CONCERNS.md §Legacy settings namespace fallback).
- Blessing a typed `getGlobal<T>(key: symbol): T | undefined` helper to replace the `(globalThis as any)[Symbol.for(...)]` pattern (CONCERNS.md §`no any` policy vs grep reality).
- Fine-tuning the dragon-guard settings schema (Security Considerations §Dragon-guard whitelist bypass surface).

Every one is a real improvement. Every one is out of scope for v1.0.

**Why it happens:**
Cleanup work primes the eye for more cleanup targets. Each individual "while I'm here" is locally cheap. The aggregate is a missed milestone.

**How to avoid:**

- Before starting AMP, write down (in PROJECT.md or a new `.planning/scope-decisions.md`) the specific anti-features for this milestone, one line each. FEATURES.md §Anti-Features already enumerates them; promote the list to `PROJECT.md` so it's adjacent to Active requirements, not buried in research.
- If a refactor temptation surfaces mid-milestone, file it as `den/features/<name>/idea.md` with the 💭 state (per AGENTS.md Feature Lifecycle) and move on. The queue is the release valve.
- Use the conventional-commits scope as a discipline: commits in this milestone should scope to `amp`, `test`, `ci`, `docs`, `rel`. Any commit scoped `refactor(dragon-digestion)` or `feat(dragon-newthing)` in this milestone is a scope-creep signal.
- The Symbol-key centralization (Pitfall 3 above) is a _judgment call_ on this line: it's arguably cleanup of amputation fallout (the exact drift just landed), not speculative. Include it in AMP only if it fits without scope-wobble. If it starts growing past `lib/globals.ts`, defer.

**Warning signs:**

- A PR's scope is `refactor(...)` during the v1.0 milestone.
- A PR body contains "while I'm here."
- The AMP phase takes longer than TEST-01 (should be the opposite — husk deletion is LOW complexity, test runner setup is MEDIUM).
- Any `den/features/<name>/` directory stops being 💭 ideas and starts getting 🐣 work during this milestone.

**Phase to address:**
**AMP** (discipline framing — write down the scope decisions at phase start) + **REL** (pre-tag checklist: "did scope creep? if yes, either cut scope back or cut a v1.1 instead of v1.0").

---

## Technical Debt Patterns

| Shortcut                                                                            | Immediate Benefit                                       | Long-term Cost                                                                            | When Acceptable                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Leave `dotsPiEnhancements.*` legacy settings fallback in `lib/settings.ts`          | Zero migration work — any old settings.json still reads | Every new setting needs a shim; `settings.ts` is one of the two legacy namespaces forever | Acceptable for v1.0 (not in Active scope). Revisit at v1.1 with a "settings v2" milestone.                                  |
| Hand-written inventory in README (DOCS-02/03) vs. auto-gen                          | LOW complexity; voice consistency; ships on time        | Drifts silently on first content addition (Pitfall 9)                                     | Acceptable for v1.0 IF the completeness check lands alongside. Not acceptable without the check.                            |
| `(globalThis as any)[Symbol.for(...)]` string-literal pattern, no central registry  | Zero refactor during cleanup                            | Every rename silently misses call sites (Pitfall 3 — just burned us)                      | Not acceptable long-term. Centralize in `lib/globals.ts` during AMP if time permits; otherwise v1.1 priority.               |
| Skip coverage reporting in CI                                                       | One fewer GHA step; one fewer metric to babysit         | Can't see which lib modules are under-tested without running locally                      | Acceptable indefinitely for this audience (dot). Revisit if contributor count > 1.                                          |
| Linux-only CI matrix                                                                | Matches dev env; one runner; fast feedback              | Cross-OS regressions are undiscovered until a non-Linux consumer tries to install         | Acceptable until a concrete non-Linux consumer exists (PROJECT.md Constraints).                                             |
| `npm pack`-based smoke test (harness) without `pi install github:` step             | Fast (~10s); deterministic; harness handles it          | Doesn't exercise the actual distribution codepath (Pitfall 5)                             | Not acceptable alone. Must ship _with_ a real `pi install` step on fresh HOME.                                              |
| Morsels for amputated subsystems deleted (not stubbed with "removed in 2026-04-22") | Cleaner tree; no pointer to nowhere                     | Agents that find the skill-name in old sessions get a 404 instead of a redirect           | Acceptable — the skills teach dead APIs; a stub would still be wrong, just shorter. CONCERNS.md recommends delete-outright. |
| Keep `hoard-*` flavour text in berrygems (dragon-curfew, dragon-musings)            | Zero work; preserves persona                            | Tonally inconsistent with "pantry" rename; prose drift vs code                            | Acceptable if rename is repo-level, persona is dragon-hoard-themed. Decide once and write the policy.                       |
| No `CONTRIBUTING.md`                                                                | One less doc to maintain                                | If a non-dot contributor ever arrives, they have no entry point                           | Acceptable indefinitely — audience is dot's machines.                                                                       |

## Integration Gotchas

| Integration                                   | Common Mistake                                                                                                                         | Correct Approach                                                                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pi runtime (jiti-loaded extensions)           | Write integration tests that `import { X } from "../extensions/dragon-Y"` directly — gets Node module cache, not pi's isolated context | Use `@marcfargas/pi-test-harness`'s `createTestSession` for every integration test; reserve direct imports for `lib/` unit tests only (Pitfall 2)                                                                |
| pi runtime (cross-extension `globalThis` bus) | Assume a publisher is loaded; treat `globalThis[Symbol.for("pantry.X")]` as non-nullable                                               | Always `panels?.register(...)`; consumers degrade quietly when a publisher isn't loaded (per ARCHITECTURE.md §Error Handling)                                                                                    |
| pi runtime (session state)                    | Write state to a side-file under the extension's own directory                                                                         | Use `tool result details` or `pi.appendEntry()`; session state is branching JSONL (AGENTS.md §Sessions & State)                                                                                                  |
| pi install contract                           | Pin the `pi` version the extensions are tested against                                                                                 | Pi is the host; pantry doesn't pin it. The symlink repair recipe (AGENTS.md:94-102) is the compatibility layer. A pi major version bump may break pantry — test against pi `main` in CI periodically, not pinned |
| GitHub Actions + pnpm                         | Set up Node before pnpm → setup-node can't detect pnpm for cache                                                                       | `pnpm/action-setup@v4` FIRST, then `actions/setup-node@v4` — order matters (STACK.md Version Compatibility)                                                                                                      |
| GitHub Actions + install smoke                | Run `pi install` against the runner's real `$HOME`                                                                                     | `HOME=$(mktemp -d)` before `pi install`; otherwise jobs in matrix pollute each other (STACK.md What NOT to Use)                                                                                                  |
| `berrygems/node_modules/` symlinks            | Commit them for "fresh clone works"                                                                                                    | They point into pi's global npm store — OS-specific, path-specific, guaranteed drift. Keep gitignored; document repair recipe (FEATURES.md §Anti-Features)                                                       |
| `.claude/` hooks                              | Assume `/home/dot/Development/hoard/` paths got swept during rename                                                                    | They didn't. Stop hooks and PreToolUse hooks fail silently on every session (Pitfall 8)                                                                                                                          |
| Morsel frontmatter                            | Hand-author YAML; trust the author                                                                                                     | Zod schema validate every `SKILL.md` in TEST-04; pi's loader tolerates missing fields silently (Pitfall 4)                                                                                                       |

## Performance Traps

Not a meaningful concern at this scale — pantry is a content repo with 17 extensions and 56 skills, installed on dot's machines. The only performance-ish concerns are surface-adjacent:

| Trap                                                                                             | Symptoms                                           | Prevention                                                                                                                  | When It Breaks                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Oversized extension files (dragon-digestion.ts at 3155 lines, dragon-parchment.ts at 2048 lines) | `/reload` latency; cognitive load when editing     | Split per AGENTS.md §Structural Rules (300-line threshold). Not urgent for v1.0 (Pitfall 10 — scope creep); queue for v1.1. | Not a perf break; a maintainability break. Breaks at the "I need to add a feature to dragon-digestion and can't find where" threshold. |
| Per-tick allocations in hot event handlers (`tool_call`, `turn_start`)                           | Agent responsiveness degrades during long sessions | Profile via pi's debug tooling if suspected; otherwise don't optimize speculatively                                         | Not observed; YAGNI.                                                                                                                   |
| Settings re-read on every access                                                                 | `readPantrySetting` hits disk each call            | `lib/settings.ts` already handles this (caching — not verified in this research; worth a unit test in TEST-02)              | Would break at high-frequency settings access; most extensions read once at load.                                                      |

## Security Mistakes

Specific to pantry's shape, not generic web security.

| Mistake                                                                                                                             | Risk                                                                                                                                                                                                  | Prevention                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings file ingested without schema validation (CONCERNS.md §Settings file exposure)                                              | Malicious or corrupted `~/.pi/agent/settings.json` injects unexpected types into extension code paths; dragon-guard's `dogAllowedTools`/`puppyAllowedTools` whitelists are the highest-risk consumers | Add Zod schema layer on top of `readPantrySetting()` for security-relevant extensions. Not in v1.0 Active scope; v1.1 priority.                                                                                                       |
| Dragon-guard whitelist bypass via user-edited settings (CONCERNS.md §Dragon-guard whitelist bypass surface)                         | Compromised `settings.json` silently adds arbitrary tools to the default-allow list                                                                                                                   | On startup, log every tool added to the allow list; emit a panel nudge ("Puppy mode: 3 custom tools whitelisted") so unexpected additions are visible. Not in v1.0 Active; v1.1 priority.                                             |
| Symbol-key drift creates silent no-ops (Pitfall 3)                                                                                  | A security-relevant extension (dragon-guard) publishes an API under the wrong key; consumers get `undefined` and fail-open rather than fail-closed                                                    | Centralize keys (Pitfall 3 remediation). For dragon-guard specifically: assert at load time that the expected consumer publishers (if any) registered. Higher priority than general key centralization because of the fail-open risk. |
| Shipped skills document env vars for amputated daemons (CONCERNS.md — `HOARD_STONE_PORT`, `HOARD_ALLY_DEFNAME`, `HOARD_GUARD_MODE`) | Users reading the skill attempt to set env vars that no longer do anything; worse, a future harness component might reclaim those names with different semantics                                      | Delete the amputated-system skills outright (Pitfall 1). Don't leave stubs that document non-existent env vars.                                                                                                                       |
| `.claude/agents/soul-reviewer.md` reads `/home/dot/Development/hoard/ETHICS.md` (CONCERNS.md §Dead import paths in soul-reviewer)   | If that path is ever re-populated by an unrelated checkout, agent reads a non-authoritative ETHICS.md and produces misleading reviews                                                                 | Delete the soul-reviewer agent — the daemon it audits is amputated. Pitfall 8 remediation.                                                                                                                                            |
| `pi install github:dotBeeps/pantry` tracks `main` — breaking changes land instantly (Pitfall 6)                                     | Malicious or accidental compromise of main propagates to every machine that re-installs before a fix lands                                                                                            | `main` branch protection, pinned install in README, `release` branch pointing at latest tag.                                                                                                                                          |

## UX Pitfalls

The "user" of pantry is either the human (dot, reading the repo) or the agent (pi loading extensions and skills). Both have UX needs.

| Pitfall                                                                                                                    | User Impact                                                                                                                                                                                                  | Better Approach                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README describes the pre-amputation repo                                                                                   | First-time reader gets wrong mental model (post-amputation pantry is _content-only_, no daemon, no persona runtime)                                                                                          | DOCS-01 rewrite is P1 per FEATURES.md. Must cover: what pantry is now, what it doesn't include anymore, install path, inventory pointer.                                                 |
| README's install instruction is unversioned (`pi install github:dotBeeps/pantry`)                                          | Anyone copying it tracks `main` with no semver buffer (Pitfall 6)                                                                                                                                            | Primary install line uses `#v1.0.0`; secondary "latest main" line is clearly labeled as fast-moving.                                                                                     |
| Missing CI badge                                                                                                           | Reader can't tell if HEAD is green; signals author doesn't trust their own gates                                                                                                                             | Badge in README below title; FEATURES.md Table Stakes.                                                                                                                                   |
| Missing LICENSE file despite every morsel frontmatter declaring `license: MIT`                                             | GitHub renders no license badge; repo appears unlicensed-by-default (all rights reserved); contradicts the frontmatter claims                                                                                | LICENSE file at repo root, Table Stakes in FEATURES.md.                                                                                                                                  |
| No per-berrygem README for multi-file extensions (`dragon-breath/`, `dragon-websearch/` — `dragon-guard/` already has one) | First-time reader of a directory extension has no in-situ orientation; must traverse to root README and back                                                                                                 | DOCS-04 per-extension README for the three directory extensions.                                                                                                                         |
| Skill `description` field too long or too short                                                                            | Pi's skill loader surfaces the description to the model at selection time; if it's too vague ("git stuff") the model picks wrong skills; if too long (>1024 chars per AGENTS.md:246) it wastes prompt budget | TEST-04 lints both: required non-empty, max 1024 chars, min some floor (say 50) to catch `description: foo`.                                                                             |
| Pi loads extensions before tools check anything — an extension that logs to stdout pollutes the TUI                        | User sees log lines in the terminal that shouldn't be there                                                                                                                                                  | ARCHITECTURE.md §Cross-Cutting Concerns already establishes: "Raw `console.log` is avoided in shipped code — diagnostic output flows through pi's UI surfaces." Add a lint rule or test. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **AMP-01 (husk removal):** `ls storybook-daemon psi allies-parity dragon-cubed berrygems/extensions/hoard-allies 2>&1` returns "No such file" for all five. Also `rg '/home/dot/Development/hoard/' .claude AGENTS.override.md` returns zero matches (Pitfall 8). Also `rg 'Symbol\.for\("hoard\.' morsels berrygems` returns zero (Pitfall 1).
- [ ] **TEST-01 (Vitest setup):** `cd berrygems && pnpm test` runs and reports at least one passing test. Not "command exists and exits 0 because no tests match" — at least one real test ran.
- [ ] **TEST-02 (lib unit tests):** Every file in `berrygems/lib/` has a `lib/<name>.test.ts`. `ls berrygems/lib/*.ts | wc -l` equals `ls berrygems/lib/*.test.ts | wc -l` (excluding test files from the first count).
- [ ] **TEST-03 (extension integration):** Every extension (17 total) has at least one integration test via pi-test-harness. A test that only asserts "extension loads without error" counts — but at minimum the tool registration and `globalThis` publication must be asserted.
- [ ] **TEST-04 (frontmatter lint):** The linter rejects (a) missing `name`, (b) `name` mismatch with directory, (c) missing `description`, (d) missing `license: MIT`, (e) `description` > 1024 chars, (f) `Symbol.for("hoard.*")` in the body, (g) `Symbol.for("pantry.<unregistered>")` in the body. Test each rejection with a fixture.
- [ ] **CI-01 (GHA workflow):** The workflow actually runs on PR and on push-to-main — not just on manual dispatch. Open a throwaway PR and verify CI triggers.
- [ ] **CI-02 (install smoke):** Both the harness smoke AND the `pi install $GITHUB_WORKSPACE` step are present (Pitfall 5). The `pi install` step uses `HOME=$(mktemp -d)`. The assertion checks extension + skill counts AND at least one specific name.
- [ ] **DOCS-01 (README rewrite):** No occurrence of "storybook-daemon", "dragon-forge", "cc-plugin", "hoard", or "daemon" outside explicit "amputated" context. Also: the primary install line uses `#v1.0.0`.
- [ ] **DOCS-02 + DOCS-03 (inventories):** `ls berrygems/extensions/` name count equals the inventory's bullet count. `find morsels/skills -name SKILL.md` count equals the inventory's entry count. Completeness check test is present (Pitfall 9).
- [ ] **DOCS-04 (per-dir-extension READMEs):** `berrygems/extensions/dragon-breath/README.md`, `berrygems/extensions/dragon-websearch/README.md` exist. (`dragon-guard/README.md` already exists per FEATURES.md.)
- [ ] **LICENSE:** `ls LICENSE` at repo root returns the file. Contents are the MIT license text with a copyright line.
- [ ] **REL-01 (v1.0.0 tag):** `git tag --list | grep v1.0.0` returns it. The tag is annotated (`git tag -a`), not lightweight. `pi install github:dotBeeps/pantry#v1.0.0` resolves (test from a fresh HOME).
- [ ] **`main` branch protection:** CI-01 is a required status check. At least one approval required for merge. (Pitfall 6.)
- [ ] **`tsc --project berrygems/tsconfig.json` returns zero errors** — currently red per CONCERNS.md Known Bugs. This blocks every other verification.
- [ ] **Root `package.json` has `"keywords": ["pi-package", ...]` and `"repository"` field** — FEATURES.md Table Stakes, trivial addition.

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall                                                | Recovery Cost                             | Recovery Steps                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitfall 1 (amputation residue shipped)                 | LOW                                       | `rg 'hoard' morsels berrygems --files-with-matches` → sweep-edit or delete. Cut a `v1.0.1` patch release.                                                                                                                                      |
| Pitfall 2 (module-cache false green)                   | MEDIUM                                    | Write the "two extensions, one session" canary test. Audit every existing integration test for direct `../extensions/` imports. Rewrite the affected tests via pi-test-harness.                                                                |
| Pitfall 3 (Symbol-key drift)                           | LOW (short-term) / HIGH (if repeated)     | `rg 'Symbol\.for\("pantry\.' berrygems morsels` → audit each against publisher list. Centralize in `lib/globals.ts` if not already. The HIGH cost is per-rename-event; centralization is the one-time fix.                                     |
| Pitfall 4 (frontmatter schema relaxed to no-op)        | MEDIUM                                    | Review `scripts/schema.ts` git history for `.optional()` additions or enum → string loosenings. Revert the loosening. Fix whichever skill originally triggered it.                                                                             |
| Pitfall 5 (install smoke misses real codepath)         | HIGH                                      | A user hits the real break first — the feedback loop is users reporting broken installs, not CI. Recovery requires adding the missing gate AND cutting a patch release AND notifying any known consumers (for pantry: dot).                    |
| Pitfall 6 (main push breaks consumers)                 | HIGH (post-incident) / LOW (pre-incident) | Pre-incident: branch protection + pinned-install docs. Post-incident: revert on `main`, cut a patch tag, update consumers' install URLs to pinned. For dot's fleet: `pi install github:dotBeeps/pantry#v1.0.<last good>` on affected machines. |
| Pitfall 7 (jiti-specific load failure that tsc missed) | MEDIUM                                    | Reproduce via pi-test-harness; convert the failure into a harness test; fix the extension. Add the reproduction pattern to the TEST-03 harness-test template.                                                                                  |
| Pitfall 8 (orphaned `.claude/` hooks)                  | LOW                                       | Sweep-replace paths, delete dead agents/skills, trim parity map. One PR's worth of work.                                                                                                                                                       |
| Pitfall 9 (README inventory drift)                     | LOW                                       | Run the completeness-check test; wherever it fails, update the README in the same PR as the missing content. If the test isn't there, add it and accept the false-fail on the first run.                                                       |
| Pitfall 10 (scope creep blew the milestone)            | HIGH                                      | Cut the milestone at its current state as `v1.0.0-rc1`, move the creep items to a `v1.1` milestone, negotiate a fresh v1.0.0 cut on a smaller scope. Acknowledge in CHANGELOG what the scope change was.                                       |

## Pitfall-to-Phase Mapping

| Pitfall                               | Prevention Phase                                                             | Verification                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- | ---- | ----------------------- | --------------------------------------------------------------- |
| 1. Amputation-residue strings         | AMP                                                                          | `rg 'Symbol\.for\("hoard\.' morsels berrygems` returns 0; CONCERNS.md's enumerated locations all fixed or deleted.                                                                            |
| 2. Module-cache false green           | TEST (TEST-01 config + TEST-03 harness-first)                                | Every integration test uses `createTestSession`, not direct extension imports. Grep-gate: `rg 'from "\.\./\.\./?extensions/' berrygems/**/*.test.ts` returns 0.                               |
| 3. Symbol-key drift                   | AMP (centralize) + TEST (lint bodies)                                        | `lib/globals.ts` exists with all current keys; `rg 'Symbol\.for\("pantry\.' berrygems` returns only in `lib/globals.ts`; TEST-04 fails fixtures with unregistered keys.                       |
| 4. Frontmatter schema decay           | TEST (TEST-04 strict schema) + DOCS (policy in `morsels/AGENTS.md`)          | Schema file exists; JSON Schema dump committed; schema rejects intentionally-bad fixtures for every required field.                                                                           |
| 5. Install smoke tests wrong codepath | CI (CI-02 both gates)                                                        | Workflow has both `verifySandboxInstall` step AND `pi install $GITHUB_WORKSPACE` step with `HOME=$(mktemp -d)`. Assertions check named extensions/skills, not just counts.                    |
| 6. Main-push is a release             | REL (install flavours doc, tag policy, branch protection)                    | README primary install uses `#v1.0.0`; `release` branch exists (optional); `main` is protected with CI + review.                                                                              |
| 7. `tsc`-green but jiti load fails    | AMP (fix current red tsc) + CI (harness load test) + REL (branch protection) | `tsc` returns 0 errors; every extension has an integration test that `createTestSession`-loads it; tsc is a required check on main.                                                           |
| 8. Orphaned `.claude/` hooks          | AMP                                                                          | `rg '/home/dot/Development/hoard/' .claude AGENTS.override.md` returns 0; `.claude/agents/soul-reviewer.md` and `.claude/skills/hoard-verify/` deleted; parity-map.json deleted or rewritten. |
| 9. README inventory drift             | DOCS (hand-write v1.0) + TEST (completeness check)                           | `scripts/check-inventory.ts` exists as a Vitest test; it passes at v1.0.0 tag.                                                                                                                |
| 10. Scope creep during cleanup        | AMP (write scope decisions) + REL (pre-tag checklist)                        | Commit log for milestone contains only `amp                                                                                                                                                   | test | ci  | docs | rel`scopes, no`refactor | feat`. PROJECT.md Active requirements are 1:1 with shipped PRs. |

## Sources

- `/home/dot/Development/pantry/.planning/codebase/CONCERNS.md` — 2026-04-22 audit. Primary source for amputation-residue specifics (Pitfalls 1, 3, 7, 8) and technical debt pattern inputs. HIGH confidence (authored from direct filesystem inspection).
- `/home/dot/Development/pantry/.planning/codebase/ARCHITECTURE.md` — Module isolation and `globalThis` bus constraints (Pitfalls 2, 3). HIGH.
- `/home/dot/Development/pantry/.planning/research/STACK.md` — pi-test-harness, Vitest 4 native loader, CI action ordering (Pitfalls 2, 5, 7). HIGH.
- `/home/dot/Development/pantry/.planning/research/FEATURES.md` — Out-of-scope list for scope-creep framing (Pitfall 10), table-stakes for "Looks Done But Isn't" checklist. HIGH.
- `/home/dot/Development/pantry/AGENTS.md` + `/home/dot/Development/pantry/berrygems/AGENTS.md` — verification gates, symlink repair, tool registration convention. HIGH. (Note: `berrygems/AGENTS.md:70` hard-codes `/home/dot/Development/hoard/` — itself evidence for Pitfall 8.)
- `~/.claude/projects/-home-dot-Development-pantry/memory/project_scope_amputation_2026_04.md` (via auto-loaded memory index) — amputation scope and rationale. HIGH.
- `@marcfargas/pi-test-harness` v0.5.0 API surface (via STACK.md Sources) — basis for Pitfall 2 and 5 remediation. HIGH.
- `badlogic/pi-mono` extension loading contract (via STACK.md Sources) — jiti isolation mechanics, `pi install` codepath. HIGH.
- No direct post-mortems exist for pantry v1.0 because it hasn't shipped yet. Pitfalls 4, 6, 9, 10 are inference from analogous ecosystems (npm package drift, Git-install distribution models, dotfiles-monorepo maintenance) crossed with pantry's specific constraints — MEDIUM confidence on those four specifically; HIGH on their remediation mechanics (which are mechanical, not speculative).

---

_Pitfalls research for: pantry v1.0 stabilization + tag cut_
_Researched: 2026-04-22_
