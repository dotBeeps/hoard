# Phase 1: Amputation Cleanup & tsc-Green — Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 20 (1 new module, 14 edit-in-place TS, 3 doc/config rewrites, 5 deletions, 2 directory deletions)
**Analogs found:** 18 / 20 (2 files have no analog — D-09 AGENTS.override.md template and AMP-01 husk deletion are first-of-kind or pure filesystem ops)

---

## File Classification

| New/Modified File                             | Role                                 | Data Flow                     | Closest Analog                                | Match Quality                                                                   |
| --------------------------------------------- | ------------------------------------ | ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `berrygems/lib/globals.ts` (NEW)              | utility/registry                     | N/A (synchronous module init) | `berrygems/lib/settings.ts`                   | role-match (shared lib module, named exports, no-any cast)                      |
| `berrygems/extensions/dragon-parchment.ts`    | extension (publisher)                | publish to globalThis         | `berrygems/extensions/dragon-image-fetch.ts`  | exact (same `API_KEY = Symbol.for(...)` + `(globalThis as any)[API_KEY] = api`) |
| `berrygems/extensions/kitty-gif-renderer.ts`  | extension (publisher)                | publish to globalThis         | `berrygems/extensions/dragon-image-fetch.ts`  | exact                                                                           |
| `berrygems/extensions/dragon-image-fetch.ts`  | extension (publisher)                | publish to globalThis         | self (primary example)                        | —                                                                               |
| `berrygems/extensions/dragon-lab.ts`          | extension (publisher)                | publish to globalThis         | `berrygems/extensions/dragon-image-fetch.ts`  | exact                                                                           |
| `berrygems/extensions/dragon-breath/index.ts` | extension (publisher + AMP-04 fix)   | publish to globalThis         | `berrygems/extensions/dragon-guard/index.ts`  | exact (dir-extension; same `../../lib/` import depth)                           |
| `berrygems/extensions/dragon-digestion.ts`    | extension (consumer)                 | read from globalThis          | `berrygems/extensions/dragon-scroll.ts`       | exact (local-const + `(globalThis as any)[KEY]` consumer)                       |
| `berrygems/extensions/dragon-guard/index.ts`  | extension (consumer + D-04 delete)   | read from globalThis          | `berrygems/extensions/dragon-guard/panel.ts`  | exact                                                                           |
| `berrygems/extensions/dragon-guard/panel.ts`  | extension (consumer)                 | read from globalThis          | `berrygems/extensions/dragon-scroll.ts`       | exact                                                                           |
| `berrygems/extensions/dragon-guard/state.ts`  | state module (D-04 delete functions) | N/A (module state)            | self                                          | —                                                                               |
| `berrygems/extensions/dragon-inquiry.ts`      | extension (consumer)                 | read from globalThis          | `berrygems/extensions/kobold-housekeeping.ts` | exact                                                                           |
| `berrygems/extensions/dragon-scroll.ts`       | extension (consumer)                 | read from globalThis          | self (primary multi-key consumer example)     | —                                                                               |
| `berrygems/extensions/dragon-tongue.ts`       | extension (consumer)                 | read from globalThis          | `berrygems/extensions/kobold-housekeeping.ts` | exact                                                                           |
| `berrygems/extensions/kobold-housekeeping.ts` | extension (consumer)                 | read from globalThis          | `berrygems/extensions/dragon-inquiry.ts`      | exact                                                                           |
| `.claude/settings.json`                       | config                               | N/A                           | self (rewrite in place)                       | —                                                                               |
| `AGENTS.override.md`                          | doc template                         | N/A                           | none (full rewrite, no live analog)           | no-analog                                                                       |
| `berrygems/lib/panel-chrome.ts`               | utility (prose scrub)                | N/A                           | self                                          | —                                                                               |
| `berrygems/lib/pi-spawn.ts`                   | utility (attribution scrub)          | N/A                           | self                                          | —                                                                               |
| `berrygems/AGENTS.md`                         | doc (factual fix)                    | N/A                           | self                                          | —                                                                               |
| `morsels/AGENTS.md`                           | doc (factual fix)                    | N/A                           | self                                          | —                                                                               |

**Deletions (no pattern needed — pure filesystem or Markdown removal):**

- `storybook-daemon/`, `psi/`, `allies-parity/`, `dragon-cubed/`, `berrygems/extensions/hoard-allies/` — `rm -rf`
- `morsels/skills/hoard-allies/`, `morsels/skills/hoard-sending-stone/` — `rm -rf`
- `.claude/parity-map.json`, `.claude/hooks/stop-doc-sync.fish`, `.claude/agents/soul-reviewer.md`, `.claude/skills/hoard-verify/` — `rm` / `rm -rf`

---

## Pattern Assignments

### `berrygems/lib/globals.ts` (NEW — utility, named exports)

**Analog:** `berrygems/lib/settings.ts`

**Conventions from analog** (`berrygems/lib/settings.ts` lines 1–17, 24–26, 125–148):

- File-level JSDoc block describing the module purpose and namespace
- `// ── Section Name ──` comment dividers
- Named exports only (no default export)
- Constants declared as `const` at module scope with `// ── Constants ──` section
- `unknown` cast (not `any`) for internal unsound operations — analog already uses `(parsed as Record<string, unknown>)` at line 49

**Exact module shape (from RESEARCH.md §globals.ts module shape):**

```typescript
// berrygems/lib/globals.ts
export const PANTRY_KEYS = {
  parchment: Symbol.for("pantry.parchment"),
  kitty: Symbol.for("pantry.kitty"),
  breath: Symbol.for("pantry.breath"),
  imageFetch: Symbol.for("pantry.imageFetch"),
  lab: Symbol.for("pantry.lab"),
} as const;

// Typed registry helpers — eliminates (globalThis as any) at every call site
export function registerGlobal<T>(key: symbol, api: T): void {
  (globalThis as unknown as Record<symbol, T>)[key] = api;
}

export function getGlobal<T>(key: symbol): T | undefined {
  return (globalThis as unknown as Record<symbol, T | undefined>)[key];
}
```

**`no any` compliance note:** `as unknown as Record<symbol, T>` is the correct pattern per `berrygems/AGENTS.md` no-any policy. The analog in `settings.ts` uses the same `unknown`-intermediary cast at line 49.

**Phase 2 integration:** Add `export const PANTRY_KEY_NAMES = Object.keys(PANTRY_KEYS) as (keyof typeof PANTRY_KEYS)[]` if TEST-04 lint needs an array form. Omit until Phase 2 confirms the need.

**Import path from consumers:**

- Single-file extensions (`extensions/foo.ts`): `import { PANTRY_KEYS, getGlobal, registerGlobal } from "../lib/globals.ts";`
- Directory extensions (`extensions/foo/index.ts`, `extensions/foo/panel.ts`): `import { PANTRY_KEYS, getGlobal, registerGlobal } from "../../lib/globals.ts";`

---

### Publisher sites (AMP-05 migration)

**Primary analog for publisher pattern:** `berrygems/extensions/dragon-image-fetch.ts`

**Current publisher shape** — local const + assignment at extension init (lines 50, 457–458):

```typescript
// dragon-image-fetch.ts:50
const API_KEY = Symbol.for("pantry.imageFetch");

// dragon-image-fetch.ts:457-458 (inside export default function)
const api = { fetch: fetchImage, vibeQuery, clearCache, getFallbackQuery };
(globalThis as any)[API_KEY] = api;
```

**After migration — replace with:**

```typescript
import { PANTRY_KEYS, registerGlobal } from "../lib/globals.ts"; // single-file

// Remove: const API_KEY = Symbol.for("pantry.imageFetch");

const api = { fetch: fetchImage, vibeQuery, clearCache, getFallbackQuery };
registerGlobal(PANTRY_KEYS.imageFetch, api);
```

**All publisher sites and their local const to remove:**

| File                     | Local const (line)                                          | Publisher call (line)                                                                         | Migration                                                                                     |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `dragon-parchment.ts`    | `const API_KEY = Symbol.for("pantry.parchment")` (line 220) | `(globalThis as any)[API_KEY] = api` (line 1873)                                              | `registerGlobal(PANTRY_KEYS.parchment, api)`                                                  |
| `kitty-gif-renderer.ts`  | `const API_KEY = Symbol.for("pantry.kitty")` (line 94)      | `(globalThis as any)[API_KEY] = api` (lines 182, 188)                                         | `registerGlobal(PANTRY_KEYS.kitty, api)` — both lines                                         |
| `dragon-image-fetch.ts`  | `const API_KEY = Symbol.for("pantry.imageFetch")` (line 50) | `(globalThis as any)[API_KEY] = api` (line 458)                                               | `registerGlobal(PANTRY_KEYS.imageFetch, api)`                                                 |
| `dragon-lab.ts`          | `const LAB_KEY = Symbol.for("pantry.lab")` (line 67)        | `(globalThis as any)[LAB_KEY] = api` (line 86)                                                | `registerGlobal(PANTRY_KEYS.lab, api)`                                                        |
| `dragon-breath/index.ts` | none (uses `Symbol.for` inline)                             | `(globalThis as any)[Symbol.for("pantry.breath")] = api` (line 480); `= undefined` (line 486) | `registerGlobal(PANTRY_KEYS.breath, api)` and `registerGlobal(PANTRY_KEYS.breath, undefined)` |

**dragon-breath also requires the AMP-04 fix first** — change line 20 import from `"../lib/settings.ts"` to `"../../lib/settings.ts"`. The new `globals.ts` import follows the same corrected depth: `"../../lib/globals.ts"`.

---

### Consumer sites (AMP-05 migration)

**Primary analog for consumer pattern — single key:** `berrygems/extensions/kobold-housekeeping.ts`

```typescript
// kobold-housekeeping.ts:34,36 — current
const PANELS_KEY = Symbol.for("pantry.parchment");
function getPanels(): any {
  return (globalThis as any)[PANELS_KEY];
}
```

**After migration:**

```typescript
import { PANTRY_KEYS, getGlobal } from "../lib/globals.ts";

// Remove: const PANELS_KEY = Symbol.for("pantry.parchment");
// Remove: function getPanels(): any { return (globalThis as any)[PANELS_KEY]; }

// Call sites become:
const panels = getGlobal<ParchmentAPI>(PANTRY_KEYS.parchment);
```

**Primary analog for multi-key consumer:** `berrygems/extensions/dragon-scroll.ts`

```typescript
// dragon-scroll.ts:38-54 — current
const PANELS_KEY   = Symbol.for("pantry.parchment");
const KITTY_KEY    = Symbol.for("pantry.kitty");
const IMAGE_FETCH_KEY = Symbol.for("pantry.imageFetch");

function getKitty(): ... { return (globalThis as any)[KITTY_KEY]; }
function getImageFetch(): ... { return (globalThis as any)[IMAGE_FETCH_KEY]; }
function getPanels(): any { return (globalThis as any)[PANELS_KEY]; }
```

**After migration:**

```typescript
import { PANTRY_KEYS, getGlobal } from "../lib/globals.ts";

// Remove all three const KEY = Symbol.for(...) lines
// Remove the three getter functions (or keep as typed wrappers over getGlobal)
// Direct usage:
const kitty = getGlobal<KittyAPI>(PANTRY_KEYS.kitty);
const imageFetch = getGlobal<ImageFetchAPI>(PANTRY_KEYS.imageFetch);
const panels = getGlobal<ParchmentAPI>(PANTRY_KEYS.parchment);
```

**All consumer sites and their local consts to remove:**

| File                     | Local consts (lines)                                        | Consumer calls (lines)                                                                     | Import path              |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| `dragon-digestion.ts`    | `PANELS_KEY` (line 46)                                      | `(globalThis as any)[PANELS_KEY]` (line 48), inline `Symbol.for("pantry.lab")` (line 2629) | `"../lib/globals.ts"`    |
| `dragon-guard/index.ts`  | `PANELS_KEY` (line 57)                                      | `(globalThis as any)[PANELS_KEY]` (line 59)                                                | `"../../lib/globals.ts"` |
| `dragon-guard/panel.ts`  | `PANELS_KEY` (line 52)                                      | `(globalThis as any)[PANELS_KEY]` (line 54)                                                | `"../../lib/globals.ts"` |
| `dragon-inquiry.ts`      | `PANELS_KEY` (line 89)                                      | `(globalThis as any)[PANELS_KEY]` (line 91)                                                | `"../lib/globals.ts"`    |
| `dragon-scroll.ts`       | `PANELS_KEY` (38), `KITTY_KEY` (39), `IMAGE_FETCH_KEY` (45) | three getter functions (lines 40–54)                                                       | `"../lib/globals.ts"`    |
| `dragon-tongue.ts`       | `PANELS_KEY` (line 39)                                      | `(globalThis as any)[PANELS_KEY]`                                                          | `"../lib/globals.ts"`    |
| `kobold-housekeeping.ts` | `PANELS_KEY` (line 34)                                      | `(globalThis as any)[PANELS_KEY]` (line 36)                                                | `"../lib/globals.ts"`    |

**Migration order per file:** (1) add import, (2) replace usages, (3) remove local const — in that order to avoid tsc errors between steps.

**Type names for `getGlobal<T>` call sites:** The existing code uses inline `as import("./dragon-lab").DragonLabAPI` casts (dragon-digestion.ts:2629). The same approach works for all sites — use the type the file already knows about. No need to re-export types from `globals.ts`.

---

### `dragon-guard/index.ts` — D-04 ally-mode block deletion

**Block to delete:** lines 188–219 (the entire `if (guardModeEnv === "ally" && allyToolsEnv)` branch plus its `before_agent_start` handler and `return`)

**Current state** (lines 187–220):

```typescript
// dragon-guard/index.ts:187-220
export default function dragonGuardExtension(pi: ExtensionAPI): void {
  // ── Ally Mode: quest-dispatched allies get locked tool whitelist ──
  const guardModeEnv = process.env.PANTRY_GUARD_MODE;
  const allyToolsEnv = process.env.PANTRY_ALLY_TOOLS;

  if (guardModeEnv === "ally" && allyToolsEnv) {
    initAllyMode(allyToolsEnv.split(","));
    pi.on("tool_call", async (event, _ctx) => { ... });
    pi.on("before_agent_start", async (event, ctx) => { ... });
    return;
  }

  // ── Legacy subagent bail-out (non-hoard subagents) ──   ← line 220, delete this comment too
  const subagentDepth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
```

**After deletion:** The `export default function dragonGuardExtension` body begins directly at the `subagentDepth` check (renaming the comment from "Legacy subagent bail-out (non-hoard subagents)" to something neutral, e.g. "Subagent guard — extensions only run in primary sessions").

**Also update import line 37:** Remove `getAllyModeToolPolicy` and `initAllyMode` from the `state.ts` import destructure.

---

### `dragon-guard/state.ts` — D-04 function deletions

**Current state** (lines 13–27, 31–68):

```typescript
// state.ts:13
export type GuardMode = "none" | "plan" | "dragon" | "ally";

// state.ts:22-27
export const MODE_LABEL: Record<GuardMode, string> = {
  none: "Dog Mode",
  plan: "Puppy Mode",
  dragon: "Dragon Mode",
  ally: "Ally Mode",   // ← delete this entry
};

// state.ts:34 — delete
let _allyToolWhitelist: Set<string> | null = null;

// state.ts:55-69 — delete all three functions
export function initAllyMode(tools: string[]): void { ... }
export function isAllyMode(): boolean { ... }
export function getAllyModeToolPolicy(toolName: string): "allow" | "block" { ... }
```

**After deletion:** `GuardMode` becomes `"none" | "plan" | "dragon"`. `MODE_LABEL` loses the `"ally"` entry. The three functions and `_allyToolWhitelist` are removed entirely.

---

### `dragon-guard/AGENTS.md` — D-04 prose scrub

**Current line 13** (only hoard reference in the file per RESEARCH.md):

```
- **Ally Mode** (`ally`): Quest-dispatched allies only. Tool whitelist set by hoard-allies at spawn time via env vars. No prompting — whitelisted tools execute, everything else is silently blocked. Cannot escalate to any other mode. Set at process birth, immutable.
```

**Action:** Delete the entire Ally Mode bullet (line 13). The mode is now gone from the type system and the entry point. The "Four modes" list becomes three.

---

### `.claude/settings.json` — D-07 + D-08 rewrite

**Current state** (full file, 33 lines):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "fish /home/dot/Development/hoard/.claude/hooks/pre-block-gosum.fish"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fish /home/dot/Development/hoard/.claude/hooks/stop-phase-gate.fish"
          },
          {
            "type": "command",
            "command": "fish /home/dot/Development/hoard/.claude/hooks/stop-parity-check.fish"
          },
          {
            "type": "command",
            "command": "fish /home/dot/Development/hoard/.claude/hooks/stop-doc-sync.fish"
          }
        ]
      }
    ]
  }
}
```

**Target state** (after D-07 drops stop-doc-sync + D-08 drops all three Stop registrations and fixes the one surviving PreToolUse path):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "fish /home/dot/Development/pantry/.claude/hooks/pre-block-gosum.fish"
          }
        ]
      }
    ]
  }
}
```

**Disposition rationale** (from RESEARCH.md §.claude/ Hook Disposition Table):

- `pre-block-gosum.fish` — KEEP, path fix to pantry
- `stop-phase-gate.fish` — DROP registration (dragon-forge amputated)
- `stop-parity-check.fish` — DROP registration (reads cc-plugin/ and parity-map.json which is deleted by D-06)
- `stop-doc-sync.fish` — DELETE file + DROP registration (D-07)

---

### `AGENTS.override.md` — D-09 full rewrite

**Current state** (22 lines, full content):

```markdown
# AGENTS.override.md

Local development overrides — gitignored, never committed.

## Local Ports

- storybook-ember MCP: `:9432` (default — change here if running on a non-standard port)
- storybook-maren MCP: `:9433`
- stone HTTP bus: `:9431`

## Local Pi Path

If running pi from local source rather than the installed npm package, note the
path here so commands in skills can be adjusted.

## Active Experiments

Note any local-only config changes, feature flags, or experimental settings active
on this machine that shouldn't be assumed in shared docs.

## Machine-Specific Notes

Add anything about this dev environment that affects agent behavior — GPU
availability for dragon-forge, local Ollama endpoint, Minecraft server address
for dragon-cubed testing, etc.
```

**Target state** (pantry-shaped — drop all amputated subsystem references):

```markdown
# AGENTS.override.md

Local development overrides — gitignored, never committed.

## Local Pi Path

If running pi from local source rather than the installed npm package, note the
path here so commands in skills can be adjusted.

## Machine-Specific Notes

Add anything about this dev environment that affects agent behavior:

- Custom `pantry.*` settings active locally (dev overrides, experimental flags)
- Non-standard pi installation paths
- Any external tools the berrygems depend on (e.g., if testing GIF rendering)
```

**Dropped sections:** Local Ports (no services run from pantry), Active Experiments (merged intent into Machine-Specific Notes), all GPU/Minecraft/MCP references.

---

### `berrygems/lib/panel-chrome.ts` — D-10 JSDoc scrub

**Line 127 — current:**

```typescript
/** Dots and sparkles. Whimsical hoard vibes. */
sparkle: {
```

**Line 127 — after:**

```typescript
/** Dots and sparkles. Whimsical vibes. */
sparkle: {
```

**Line 289 — current:**

```typescript
/** Ice crystal edges. Frozen hoard aesthetic. ❈ */
ice: {
```

**Line 289 — after:**

```typescript
/** Ice crystal edges. Frozen aesthetic. ❈ */
ice: {
```

---

### `berrygems/lib/pi-spawn.ts` — D-11 attribution scrub

**Line 9 — current** (inside file-level JSDoc):

```
 * Extracted from berrygems/extensions/hoard-allies/spawn.ts for use across
 * any extension that needs to dispatch pi subprocesses.
```

**Action:** Delete this line. The sentence documents a migration from an amputated extension; it provides no current orientation value. The module description above (lines 3–8) already fully describes what the file is and does. The surrounding JSDoc remains intact.

---

### `berrygems/extensions/dragon-digestion.ts` — D-11 stale TODO scrub

**Lines 1938–1945 — current:**

```typescript
/**
 * Anthropic beta feature needed for context_management API.
 * NOT currently injected — registerProvider header override strips OAuth betas
 * (claude-code-20250219, oauth-2025-04-20), causing 401 for OAuth users.
 * Blocked until hoard-lab extension can detect auth type and merge headers safely.
 * See: den/plans/dragon-digestion-v2.md "Beta Header Setup" section.
 */
// const ANTHROPIC_CONTEXT_MGMT_BETA = "context-management-2025-06-27";
```

**Action:** Delete the entire block (JSDoc comment + commented-out const). Per RESEARCH.md §AMP-03 hoard-flavor table and Assumptions Log A3: the beta API remains blocked for a separate reason (OAuth header stripping); keeping a stale hoard-lab reference alongside a commented-out const provides no signal for future implementors. Deletion is the correct action; the auth header problem should be tracked separately if it becomes unblocked.

---

### `berrygems/AGENTS.md` — D-12 factual fixes

**Line 16 — current:**

```
- **storybook-daemon** is the persistent core — mind, soul, connectors. berrygems tools are what the daemon _uses_ when inhabiting a pi session.
```

**Line 16 — after** (rewrite to post-amputation framing — daemon is gone, berrygems stands alone):

```
- **berrygems** are pi extensions — self-contained tools that run within a pi session. Each extension loads independently; no persistent daemon coordinates them.
```

(Exact prose is planner's discretion — the requirement is to remove the storybook-daemon present-tense framing.)

**Line 70 — current:**

```bash
cd /home/dot/Development/hoard && tsc --project berrygems/tsconfig.json
```

**Line 70 — after:**

```bash
tsc --project berrygems/tsconfig.json
```

(Run from repo root `/home/dot/Development/pantry` as documented in AGENTS.md:88. The `cd` is wrong and unnecessary.)

---

### `morsels/AGENTS.md` — D-12 factual fix

**Line 13 — current:**

```
- **storybook-daemon** is the persistent core. Morsels are portable knowledge any body can consume — during a pi session, through a daemon-directed subagent, or standalone.
```

**Line 13 — after** (rewrite to remove daemon framing):

```
- **berrygems** is the programmatic tool layer. Some morsels teach agents how to use berrygems APIs directly.
```

(Exact prose is planner's discretion — the requirement is to remove the "storybook-daemon is the persistent core" framing.)

---

### `berrygems/extensions/dragon-digestion.ts` — AMP-05 comment updates

**Line 114 — current:**

```typescript
// Check: (globalThis as any)[Symbol.for("pantry.lab")]?.isActive("anthropic.context-management")
```

**Line 114 — after:**

```typescript
// Check: getGlobal<DragonLabAPI>(PANTRY_KEYS.lab)?.isActive("anthropic.context-management")
```

---

### JSDoc example updates (AMP-05 — comment-only changes)

Three file headers document the old consumer pattern. After AMP-05 migration:

| File                    | Line | Current JSDoc example                                                     | Updated example                                                       |
| ----------------------- | ---- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `dragon-parchment.ts`   | 12   | `const panels = (globalThis as any)[Symbol.for("pantry.parchment")]`      | `const panels = getGlobal<ParchmentAPI>(PANTRY_KEYS.parchment)`       |
| `dragon-image-fetch.ts` | 10   | `const imageFetch = (globalThis as any)[Symbol.for("pantry.imageFetch")]` | `const imageFetch = getGlobal<ImageFetchAPI>(PANTRY_KEYS.imageFetch)` |
| `kitty-gif-renderer.ts` | 9    | `const kitty = (globalThis as any)[Symbol.for("pantry.kitty")]`           | `const kitty = getGlobal<KittyAPI>(PANTRY_KEYS.kitty)`                |

---

## Shared Patterns

### Import depth rule (applies to ALL AMP-05 migrations)

**Source:** Verified against `dragon-guard/index.ts:3`, `dragon-guard/panel.ts:19`, `dragon-guard/settings.ts:13`

```
berrygems/extensions/single-file.ts       → "../lib/globals.ts"
berrygems/extensions/dir-ext/index.ts    → "../../lib/globals.ts"
berrygems/extensions/dir-ext/panel.ts    → "../../lib/globals.ts"
```

**Apply to:** Every file receiving a `globals.ts` import.

**Bug reference (AMP-04):** `dragon-breath/index.ts:20` currently has `"../lib/settings.ts"` instead of `"../../lib/settings.ts"`. This is the one tsc error. Fix this before all other AMP-05 work so `tsc` is usable as a gate.

### `no any` policy (applies to globals.ts authoring)

**Source:** `berrygems/AGENTS.md` (no-any policy) + `berrygems/lib/settings.ts:49`

The correct unsound cast uses `unknown` as intermediary:

```typescript
// CORRECT — no any
(globalThis as unknown as Record<symbol, T>)[key](
  // WRONG — violates no-any
  globalThis as any,
)[key];
```

**Apply to:** `berrygems/lib/globals.ts` body only. Consumer sites switch from the `as any` pattern to `getGlobal<T>(...)` which is clean — no cast at all.

### Section comment style (applies to new globals.ts)

**Source:** `berrygems/lib/settings.ts:22-26`, `berrygems/extensions/dragon-parchment.ts` throughout

```typescript
// ── Section Name ──
```

Exactly two em-dashes, one space padding each side. Apply to `globals.ts` sections: `// ── Keys ──`, `// ── Typed Registry ──`.

### Fish scripting (applies to any tooling or hook files)

**Source:** `AGENTS.md` verification section, CONTEXT.md §Established Patterns

All repo-local scripts use fish, not bash. Hook bodies in `.claude/hooks/` are `.fish` files. The surviving `pre-block-gosum.fish` retains its `.fish` extension and fish syntax.

---

## No Analog Found

| File                 | Role                | Data Flow | Reason                                                                                                                |
| -------------------- | ------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.override.md` | doc template        | N/A       | Gitignored local file; no committed template exists; content is machine-specific overrides with no prior pantry-shape |
| AMP-01 husk dirs     | filesystem deletion | N/A       | Pure `rm -rf`; no code pattern applies                                                                                |

---

## Metadata

**Analog search scope:** `berrygems/lib/`, `berrygems/extensions/`, `.claude/`, root docs
**Files scanned:** 18 source files read directly; 4 via grep-only spot-checks
**Pattern extraction date:** 2026-04-22
