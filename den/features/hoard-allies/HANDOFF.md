# Handoff: hoard-allies

> **Last updated:** 2026-04-07
> **From:** Ember 🐉
> **For:** Next session picking up hoard-allies work

## Current State

**Phase 2 is implemented.** The extension is at 🔥 beta — functional, needs manual testing via `/reload`.

### What Exists

- **`berrygems/extensions/hoard-allies.ts`** (~800 lines) — full extension:
  - 3D taxonomy: `<adjective>-<noun>-<job>` with 13 curated combos
  - 5 jobs with per-job system prompts, tool restrictions, output formats
  - Formula-based budget: `cost = noun_weight × thinking_multiplier × job_multiplier`
  - Budget enforcement via `tool_call` interception (deterministic blocking)
  - Named allies from shuffled pools (72 names total)
  - Name injection via `pendingNames` bridge (tool_call → before_agent_start)
  - Completion tracking + refund (50% on complete, 100% on failure)
  - `/allies` and `/allies-regen` commands
  - System prompt injection for primary session (taxonomy + budget status)
  - Context trimming: strips APPEND_SYSTEM for subagents
  - Cleans old 2D agent defs on regeneration

- **`morsels/skills/hoard-allies/SKILL.md`** (~155 lines) — dispatch strategy skill:
  - Full cost table with formulas for all 13 combos
  - Decision tree (job → noun → adjective)
  - Budget explanation + dispatch patterns with cost annotations
  - Guidelines for when to dispatch vs do it yourself

- **`.pi/agents/<adj>-<noun>-<job>.md`** — auto-generated on session start, 13 files

- **Settings:** `hoard.allies.*` including `budget.nounWeights`, `budget.thinkingMultipliers`, `budget.jobMultipliers`, `budget.pools`, `budget.refundFraction`

### What Was Removed

- `berrygems/extensions/hoard-kobolds.ts` — replaced by hoard-allies.ts
- `morsels/skills/hoard-kobolds/` — replaced by hoard-allies/
- Old 2D agent defs (silly-kobold.md, etc.) — auto-cleaned on next session start

## What's Next

### Phase 3 — Dispatch Absorption 🐣

Register our own `subagent` tool with taxonomy awareness. Currently we intercept the built-in subagent tool via `tool_call` events, but absorption means we *own* the tool and can:
- Pre-dispatch: show cost estimate in tool confirmation
- Post-dispatch: report actual cost in tool result
- Integrate with dragon-breath for carbon tracking
- Route to optimal provider based on ally tier

Reference: `~/.npm/lib/node_modules/pi-subagents/` has the old spawn machinery if needed.

### Phase 4+ — Future Ideas 💭

- Inter-agent chatroom for active allies
- Long-running dispatcher session (prompt caching) + short-lived worker allies (quota absorption)
- Provider-aware dispatch (match ally to cheapest available provider)

## Key Files

| File | Role |
|------|------|
| `den/features/hoard-allies/AGENTS.md` | Full spec and phase tracker |
| `berrygems/extensions/hoard-allies.ts` | The extension |
| `morsels/skills/hoard-allies/SKILL.md` | Dispatch strategy skill |
| `berrygems/lib/settings.ts` | Settings reader (`readHoardSetting`) |
| `ETHICS.md` | §3.7 drives the budget system |

## Verification

```bash
# Type check
cd /home/dot/Development/hoard && tsc --project berrygems/tsconfig.json

# Test
/reload  # in pi, then /allies to see taxonomy, dispatch some subagents
```
