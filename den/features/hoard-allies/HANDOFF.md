# Handoff: hoard-allies

> **Last updated:** 2026-04-07
> **From:** Ember 🐉
> **For:** Next session picking up hoard-allies work

## Current State

**Phase 3 (quest tool) is implemented and tested.** Extension is at 🔥 beta.

First successful dispatch: **Wort the Silly Kobold Scout** — copilot/haiku, 0.5 pts, model cascade worked.

### What Exists

- **`berrygems/extensions/hoard-allies/`** — directory extension (~1,560 lines across 5 files):
  - `index.ts` — taxonomy, budget, events, `/allies` command, shared API on globalThis
  - `quest-tool.ts` — quest tool (single, rally, chain modes), budget enforcement
  - `spawn.ts` — pi process spawning (`pi --mode json`), NDJSON parsing
  - `cascade.ts` — FrugalGPT model fallback, provider cooldown tracking
  - `types.ts` — shared interfaces

- **`morsels/skills/hoard-allies/SKILL.md`** — dispatch strategy skill (~155 lines)

- **`.pi/agents/<adj>-<noun>-<job>.md`** — 13 auto-generated agent defs

- **`den/features/hoard-allies/quest-design.md`** — griffin-researcher design doc

### Known Issues

1. **Dragon-guard coupling** — allies hit dragon-guard in Dog Mode. Jobs should pair with guard profiles (scouts → read-only, coders → write-gated). This is the next piece of work.

2. **NDJSON parsing** — the `parseSpawnOutput` function handles several event formats but hasn't been tested with all pi output modes. May need refinement.

3. **Old interception code** — `tool_call`/`tool_result` interception for the built-in `subagent` tool still exists in index.ts. Can be removed once dot disables pi-subagents and the quest tool is fully validated.

4. **Rally + chain untested** — single quest works, parallel and sequential modes haven't been tested yet.

## What's Next

### Phase 4 — Dragon-Guard Coupling 🐣

Allies should run with guard profiles matching their job. The quest tool controls WHICH tools, dragon-guard controls HOW those tools behave.

- Scout/reviewer/researcher/planner → read-only guard profile (Puppy mode)
- Coder → write-gated guard profile (Dog mode)
- Guard mode passed via spawn args or env var

This requires coordination with `berrygems/extensions/dragon-guard/`.

### Phase 5+ — Future

- Inter-agent chatroom
- Long-running dispatcher sessions (prompt caching)
- Provider-aware routing
- Dragon-breath carbon integration

## Key Files

| File | Role |
|------|------|
| `den/features/hoard-allies/AGENTS.md` | Full spec and phase tracker |
| `berrygems/extensions/hoard-allies/` | The extension (5 files) |
| `morsels/skills/hoard-allies/SKILL.md` | Dispatch strategy skill |
| `berrygems/extensions/dragon-guard/` | Guard extension (next coupling target) |
| `berrygems/lib/settings.ts` | Settings reader (`readHoardSetting`) |
| `ETHICS.md` | §3.7 drives the budget system |

## Verification

```bash
# Type check
cd /home/dot/Development/hoard && tsc --project berrygems/tsconfig.json

# Test
/reload  # in pi, then use quest tool to dispatch allies
```
