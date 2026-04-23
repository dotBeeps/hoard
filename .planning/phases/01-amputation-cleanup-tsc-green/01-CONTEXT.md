# Phase 1: Amputation Cleanup & tsc-Green - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-amputation residue is swept from the working tree and all shipped surfaces; `tsc --project berrygems/tsconfig.json` returns zero errors; cross-extension symbol keys are centralized in `berrygems/lib/globals.ts` with a typed registry helper; five AMP-XX requirements (AMP-01..05) close.

Scope covers:

- Husk directory removal (AMP-01)
- Stale `/home/dot/Development/hoard/` path sweep across `.claude/` and `AGENTS.override.md` (AMP-02)
- Stale `Symbol.for("hoard.*")`, `HOARD_*` env-var, and hoard-API-string residue in shipped code + morsels (AMP-03)
- `dragon-breath/index.ts:20` import-path fix returning tsc to zero (AMP-04)
- `berrygems/lib/globals.ts` + `PANTRY_KEYS` + typed `getGlobal`/`registerGlobal` helpers + migration of all existing `(globalThis as any)[Symbol.for(...)]` call sites (AMP-05, expanded)

Out of scope (preserved boundary):

- Test framework, CI, inventories, README, LICENSE, release (Phases 2–5)
- Persona flavor prose inside `dragon-curfew` / `dragon-musings` — explicit success-criterion carve-out
- Full AGENTS.md rewrite (Phase 3 DOCS-01 owns the post-amputation narrative rewrite at scale; Phase 1 only corrects factual errors)
- `den/features/` reorganization — internal planning archive, not-shipped
- `ETHICS.md:167` identity-reflection passage — ambiguous-but-not-API, left for a future identity pass

</domain>

<decisions>
## Implementation Decisions

### PANTRY_KEYS module (AMP-05)

- **D-01:** `berrygems/lib/globals.ts` exports a single const object: `export const PANTRY_KEYS = { parchment: Symbol.for('pantry.parchment'), ... } as const`. Consumers read `PANTRY_KEYS.<name>`.
- **D-02:** Same module also exports a typed registry: `registerGlobal<T>(key: symbol, api: T): void` and `getGlobal<T>(key: symbol): T | undefined`. This kills the `(globalThis as any)[Symbol.for(...)]` pattern at its source.
- **D-03:** Migrate all 16+ existing `(globalThis as any)[Symbol.for('pantry.*')]` call sites across `berrygems/extensions/` to the typed helper in this phase. `rg 'globalThis as any' berrygems/extensions` is a verification gate alongside the ROADMAP success criteria.
- The canonical key list in `PANTRY_KEYS` is also the input Phase 2 TEST-04 will consume for its morsel-body lint (reject unregistered `pantry.*` keys). Export the values as an array or keep the object keys enumerable for that lint — whichever the linter ingests more cleanly; planner's call.

### Dragon-guard dead ally-mode (AMP-03)

- **D-04:** Delete the ally-mode branch in `berrygems/extensions/dragon-guard/index.ts` entirely. Specifically: the `if (allyMode)` block, the `HOARD_GUARD_MODE` / `HOARD_ALLY_TOOLS` env-var reads, the `before_agent_start` ally-prompt injection at approx. lines 205–217, and the `// ── Legacy subagent bail-out (non-hoard subagents) ──` comment at line 220. Plus the matching prose in `berrygems/extensions/dragon-guard/AGENTS.md` at lines 13, 104, 161.
- Rationale: the feeding extension (`hoard-allies`) is amputated; nothing sets these env vars; the branch is dead code loaded on every pi startup. Removing it simplifies dragon-guard ahead of Phase 2 integration tests.

### `hoard-*` morsel disposition (AMP-03)

- **D-05:** Delete `morsels/skills/hoard-allies/` and `morsels/skills/hoard-sending-stone/` outright (`rm -rf`). Pi's `morsels/skills/*/SKILL.md` glob auto-drops them from discovery. No tombstone stubs, no minimal-scrub rewrites. These 296+204 lines document APIs that no longer exist; deletion removes the single largest piece of amputation fallout per CONCERNS.md.

### `.claude/` sweep scope (AMP-02, AMP-03)

- **D-06:** Delete `.claude/parity-map.json` (147 lines of cc-plugin parity; cc-plugin is amputated; every entry points at deleted disk artifacts).
- **D-07:** Delete `.claude/hooks/stop-doc-sync.fish` entirely. Its logic exists to keep `parity-map.json` in sync with live code; with the map deleted (D-06), the hook has nothing to check. Also drop its registration in `.claude/settings.json`.
- **D-08:** Path-rewrite `.claude/settings.json` hook paths from `/home/dot/Development/hoard/...` to the current pantry path. After rewrite, verify the targeted hook files still exist; drop any registration whose hook file has been removed (includes D-07 registration and any hook pointing at `hoard-verify/` or other amputated targets).
- **D-09:** Full template rewrite of `AGENTS.override.md` (gitignored, local-only). User-acknowledged risk of losing personal customization; the file template currently references amputated subsystems (`storybook-ember MCP`, `stone HTTP bus`, `dragon-forge`, `dragon-cubed`), so a minimal scrub would leave dangling concept references.

### Hoard-flavor cleanup beyond the carve-out (AMP-03)

- **D-10:** Scrub hoard-flavor jsdoc/comments in `berrygems/lib/panel-chrome.ts:127,289` to neutral prose ("Whimsical hoard vibes" → "Whimsical vibes"; "Frozen hoard aesthetic" → "Frozen aesthetic"). The `berrygems/extensions/dragon-guard/index.ts:220` comment ("Legacy subagent bail-out (non-hoard subagents)") is moot after D-04 removes the block it describes.
- **D-11:** Fix dangling attributions and stale TODOs: `berrygems/lib/pi-spawn.ts:9` attribution ("Extracted from berrygems/extensions/hoard-allies/spawn.ts...") — remove or rewrite to reflect current origin; `berrygems/extensions/dragon-digestion.ts:1942` TODO ("Blocked until hoard-lab extension can detect auth type...") — the blocker is amputated, so either resolve the TODO (write the auth detection inline) or delete it. Planner's call per site.
- **D-12:** Rewrite daemon-present-tense framing in `berrygems/AGENTS.md:16` ("storybook-daemon is the persistent core — mind, soul, connectors. berrygems tools are what the daemon uses...") and `morsels/AGENTS.md:13` (same framing) to describe post-amputation content-only pantry. `berrygems/AGENTS.md:70` wrong cd path (`/home/dot/Development/hoard/`) is already required by the success-criterion-2 grep gate. `ETHICS.md:167` identity passage is left as-is (not technically an error; CONCERNS.md called it "ambiguous"). Full AGENTS.md rewrite belongs in Phase 3 DOCS-01; Phase 1 only corrects factual errors.

### den/features/ archive (AMP-03)

- **D-13:** Leave `den/features/` untouched. It is internal planning archive (AGENTS.md:54, "not shipped"), therefore out of AMP-03 scope. The one live inbound cross-reference (`morsels/skills/hoard-allies/SKILL.md:24 → den/features/hoard-allies/AGENTS.md`) disappears when D-05 deletes that skill. Once the skill is gone, `den/` has no live code/doc pointing in; remaining hoard references are historical archive. Any reorganization deferred to post-v1.0.

### Claude's Discretion

- **Commit granularity / ordering.** Default: one atomic commit per AMP-XX (5 commits), AMP-04 first so every subsequent commit verifies against a green `tsc`. Planner may re-group if incidental dependencies emerge (e.g., AMP-05 migration touches files that AMP-03 also edits).
- **Exact shape of the `PANTRY_KEYS` object's type export surface.** `as const` is locked (D-01) but whether to also export `type PantryKey = keyof typeof PANTRY_KEYS` or `type PantryKeyValue = (typeof PANTRY_KEYS)[PantryKey]` is discretionary. Add if used; skip if not.
- **Pi-spawn.ts:9 rewrite vs removal.** If the extracted-from-hoard-allies/spawn.ts origin note is load-bearing for understanding (e.g., explains why the API shape looks the way it does), rewrite; if it's just credit for deleted code, delete.
- **Dragon-digestion.ts:1942 TODO resolution.** If the auth-type detection is a few lines to inline, resolve. If it's a real chunk of work, delete the TODO and add a new note (or an issue) noting the capability was blocked on the amputated `hoard-lab`.

### Folded Todos

None folded — `gsd-sdk query todo.match-phase 1` returned zero matches.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope (locked requirements + success criteria)

- `.planning/ROADMAP.md` §Phase 1 — goal, 5 success criteria (grep gates, tsc-green, PANTRY_KEYS existence), requirements map
- `.planning/REQUIREMENTS.md` §Amputation Cleanup — AMP-01..05 wording (authoritative)
- `.planning/PROJECT.md` §Active + §Out of Scope + §Key Decisions — scope boundary, v1.0 milestone framing

### Amputation residue inventory (primary input for AMP-01..03)

- `.planning/codebase/CONCERNS.md` §Amputation Fallout — enumerates every in-scope residue site by file:line. This is the authoritative to-do list for the grep sweeps. Read in full before starting AMP-02 or AMP-03.
- `.planning/codebase/CONCERNS.md` §Known Bugs — documents the `dragon-breath/index.ts:20` one-line fix that closes AMP-04 and the pattern-match precedent in `dragon-guard/index.ts` / `dragon-websearch/index.ts`.
- `.planning/codebase/CONCERNS.md` §Fragile Areas §Cross-extension communication + §Symbolic-key string drift — design rationale for `PANTRY_KEYS` and the typed `getGlobal/registerGlobal` helpers (AMP-05 + D-01..D-03).

### Layer conventions (must be respected during edits)

- `AGENTS.md` §Verification — the one automated gate is `tsc --project berrygems/tsconfig.json`; AMP-04 unblocks this for the rest of the milestone. Also documents the fish-not-bash scripting rule that applies to any tooling written here.
- `berrygems/AGENTS.md` §Structural Rules — 300-line split threshold (informational; several extensions exceed it already, don't widen the violation), `no any` policy (relevant because D-02 typed helper replaces the blessed `as any` pattern).
- `morsels/AGENTS.md` §Frontmatter requirements — informational; Phase 2 TEST-04 will lint against this, but the schema is not yet authored. AMP-03 must not add new frontmatter that would fail the yet-to-be-written Zod schema.

### Repo structure (orientation for all file-paths)

- `.planning/codebase/STRUCTURE.md` — full repo layout, including the husk directories to remove (AMP-01) and the shape of `berrygems/lib/` and `berrygems/extensions/`.
- `.planning/codebase/ARCHITECTURE.md` §Workspace boundary — confirms root `package.json` stays a pi-package manifest (do NOT propose root-level workspace conversion as part of this phase).
- `.planning/codebase/CONVENTIONS.md` — code-style conventions that constrain the migrations in D-03 (typed helper adoption) and D-10/D-11 (comment rewrites).

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `berrygems/lib/settings.ts` — the existing `readPantrySetting()` helper already understands the `pantry.*` namespace with a `dotsPiEnhancements.*` legacy fallback. No changes expected here for Phase 1.
- Pattern precedent for AMP-04: `berrygems/extensions/dragon-guard/index.ts` and `berrygems/extensions/dragon-websearch/index.ts` already use `../../lib/settings.ts` (two dots) correctly. `dragon-breath/index.ts:20` just needs the same pattern.
- Pattern precedent for AMP-05 typed helper: no existing typed-global helper in the codebase — this is new surface in `berrygems/lib/globals.ts`. But 16+ existing consumer sites show the shape: `(globalThis as any)[Symbol.for("pantry.<name>")]`. All are straightforward swap-ins for `getGlobal<T>(PANTRY_KEYS.<name>)`.

### Established Patterns

- Cross-extension APIs publish via `globalThis[Symbol.for("pantry.<name>")]` because pi loads each extension in its own jiti module context and extensions cannot `import` each other. The `PANTRY_KEYS` object + typed helper formalizes this pattern without changing its runtime semantics.
- `pnpm --dir berrygems <cmd>` is the invocation pattern for anything under `berrygems/` (it's the only pnpm workspace in the repo; root `package.json` is a pi-package manifest, not an npm workspace).
- Fish, not bash, for all repo-local scripts and hook bodies.

### Integration Points

- `PANTRY_KEYS` (D-01) is a **Phase 2 input**: TEST-04's morsel-body lint rejects "unregistered `pantry.*` keys" and needs the canonical list. Expose the key names in a form the lint can ingest (either `Object.keys(PANTRY_KEYS)` or a sibling `PANTRY_KEY_NAMES` array).
- `.claude/settings.json` hook paths (D-08) are the entry point for any surviving hook. After D-07 drops `stop-doc-sync.fish` and D-08 rewrites the other paths, verify every registration has a live target file.
- `dragon-breath/index.ts` (AMP-04) imports from `../../lib/settings.ts` will also need auditing: if dragon-breath imports any other symbol from `../lib/*` with the one-dot mistake, fix all occurrences, not just line 20.

</code_context>

<specifics>
## Specific Ideas

- **Verification should be grep-based and explicit.** The success criteria in ROADMAP.md are all phrased as grep/rg assertions or `tsc` exit codes. Planner should express each AMP-XX's done-ness as a shell command, not a subjective check.
- **AMP-04 goes first in the commit order.** One-line fix, unblocks `tsc` as a gate for every subsequent commit. If planner disagrees (e.g., AMP-01 husk removal first because it shrinks the verification surface), it should explicitly justify the reorder in PLAN.md.
- **D-05 deletion cascade.** Deleting `morsels/skills/hoard-allies/` also eliminates the one live inbound reference into `den/features/hoard-allies/`, which is why D-13 can safely leave `den/` untouched. Planner should order D-05 before any den/ verification step.
- **D-09 AGENTS.override.md template.** User opted for full rewrite over minimal scrub. Planner should draft a pantry-shaped template (no daemon MCPs, no dragon-forge GPU notes, no cc-plugin parity refs) and commit it as the new baseline — not pull from a hoard-era template.

</specifics>

<deferred>
## Deferred Ideas

- **den/features/ reorganization.** Mechanical relocation or banner-adding to amputated subsystem planning docs. Out of AMP-03 scope per D-13; revisit post-v1.0 if den/ grows a consumer.
- **ETHICS.md identity pass.** Whether the 2026-04-22 amputation was a rename or an identity severance. Line 167 reflects the old framing. Not an API error; not a verification-gate item. Deferred for a future ETHICS.md revision cycle.
- **Full AGENTS.md post-amputation rewrite.** Phase 1 corrects factual errors only (D-12); Phase 3 DOCS-01 owns the full narrative rewrite in parallel with the README.
- **Typed registry wrapper around the globalThis slot.** D-02 ships the helper inside `lib/globals.ts`. A richer `registry.ts` module with version negotiation, `register/unregister` lifecycle, or consumer introspection was considered by CONCERNS.md §Fragile Areas but is scope creep. Revisit if a concrete need surfaces post-v1.0.
- **Settings schema validation (CONCERNS.md §Security).** Adding a Zod/Typebox layer over `readPantrySetting()` — defers to Phase 2 alongside TEST-04's shared frontmatter schema; same Zod dependency.

</deferred>

---

_Phase: 01-amputation-cleanup-tsc-green_
_Context gathered: 2026-04-23_
