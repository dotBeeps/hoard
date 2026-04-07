# Handoff: hoard-allies Phase 2 Development

> **Date:** 2026-04-07
> **From:** Ember 🐉 (this session)
> **For:** Next session (Ember or any agent working on hoard-allies)

## Context

This session ran a full hoard audit, migrated dragon-cubed into the monorepo, and forged hoard-kobolds (Phase 1 of what is now hoard-allies). We burned through dot's Anthropic budget dispatching 10 sonnet reviewers — which proved the need for this system.

## Current State

### What Exists (Phase 1 — done)
- **`berrygems/extensions/hoard-kobolds.ts`** — Extension with:
  - Settings-driven agent def generation (writes `.pi/agents/*.md` on session start)
  - System prompt injection (dispatch rules, taxonomy)
  - Strips `APPEND_SYSTEM.md` from subagent contexts
  - `/kobolds` and `/kobolds-regen` commands
  - Reads all config from `hoard.kobolds.*` settings
- **`morsels/skills/hoard-kobolds/SKILL.md`** — Skill teaching dispatch strategy
- **`.pi/agents/*.md`** — 8 agent defs (auto-generated, 2D: thinking × model)
- **Settings** in `~/.pi/agent/settings.json` under `hoard.kobolds`

### What's Specced (Phase 2 — ready to build)
- **`den/features/hoard-allies/AGENTS.md`** — Full 422-line spec covering:
  - Three-dimension taxonomy: `<adjective>-<noun>-<job>` (e.g., "Grix the Silly Kobold Scout")
  - 5 job roles: scout, reviewer, coder, researcher, planner
  - Tool restrictions per job
  - Allowance system (spawn budgets, tier limits, refund on complete)
  - Named allies with name pools (30 kobold, 30 griffin, 14 dragon names)
  - Context trimming (strip persona, skip digestion for subagents)
  - Inter-agent communication chatroom (Phase 3)
  - Full technical implementation details (pi hooks, enforcement flow, agent def format)

## What Needs Building (Phase 2)

### Step 1: Rename hoard-kobolds → hoard-allies
- Rename `berrygems/extensions/hoard-kobolds.ts` → `hoard-allies.ts`
- Rename `morsels/skills/hoard-kobolds/` → `hoard-allies/`
- Update settings namespace from `hoard.kobolds.*` → `hoard.allies.*` (keep legacy fallback)
- Update root AGENTS.md feature tables
- Update `/kobolds` command → `/allies`

### Step 2: Add job dimension
- Add 5 jobs to the TIERS array: scout, reviewer, coder, researcher, planner
- Each job defines: tools list, system prompt template, behavior instructions, report-back triggers
- Generate 13 curated `<adj>-<noun>-<job>` agent defs (see spec for the list)
- Agent def filenames: `silly-kobold-scout.md`, `wise-griffin-reviewer.md`, etc.

### Step 3: Named allies
- Name pools as constants in the extension (see spec for names)
- Shuffle on session start, pop on dispatch
- Inject `{Name}` into agent system prompts
- Display names use natural capitalization: "Grix the Silly Kobold Scout"

### Step 4: Allowance tracking
- State on `globalThis[Symbol.for("hoard.allies.state")]`
- Track active allies, spawn counts, name queues
- Enforce spawn budgets (kobold=0, griffin=2, dragon=4, primary=8)
- Refund slots when allies complete
- Block over-budget requests deterministically

### Step 5: Absorb pi-subagents dispatch
- **pi-subagents is NOT a dependency** — it's the existing tool we're replacing
- It's currently uninstalled. Its source is still at `~/.npm/lib/node_modules/pi-subagents/` for reference
- Key files to study: `pi-spawn.ts` (resolve pi binary), `pi-args.ts` (build CLI args), `execution.ts` (spawn + stream)
- hoard-allies needs to register its own `subagent` tool that:
  1. Parses agent name → extracts taxonomy dimensions
  2. Checks allowance → blocks or approves
  3. Builds pi CLI args (model, thinking, tools from job, system prompt with name)
  4. Spawns pi subprocess
  5. Streams results back
  6. Tracks ally lifecycle (active → completed/failed)
  7. Refunds spawn slots on completion

## Key Files to Read

| File | Why |
|------|-----|
| `den/features/hoard-allies/AGENTS.md` | **THE SPEC** — read this first |
| `berrygems/extensions/hoard-kobolds.ts` | Current Phase 1 code to evolve |
| `~/.npm/lib/node_modules/pi-subagents/` | Reference implementation for dispatch (not a dependency) |
| `berrygems/extensions/dragon-digestion.ts` | Context management patterns |
| `berrygems/lib/compaction-templates.ts` | Summary templates (reusable for ally result synthesis) |
| `berrygems/lib/settings.ts` | Settings reader (readHoardSetting) |
| `ETHICS.md` | Carbon accountability (§3.7) drives this whole feature |

## Verification

```bash
# Type check
cd /home/dot/Development/hoard && tsc --project berrygems/tsconfig.json

# Test after changes
/reload  # in pi, then test /allies command and subagent dispatch
```

## What NOT to Do

- Don't install pi-subagents — we're replacing it, not wrapping it
- Don't generate all 60 taxonomy permutations — only the 13 curated combos
- Don't skip the allowance system — deterministic enforcement is an ethical requirement
- Don't let kobolds spawn subagents — they report back, always
