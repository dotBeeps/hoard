# Dragon-Guard × Hoard-Allies — Guard Coupling Spec

> **Date:** 2026-04-07
> **Status:** 🥚 planned
> **Governed by:** [ETHICS.md](../../../ETHICS.md)

## Summary

Evolve dragon-guard from three tiers (Dog, Puppy, Dragon) to four tiers (Puppy, Dog, Ally, Dragon). The new Ally tier provides deterministic tool enforcement for quest-dispatched allies, replacing the current "bail out for subagents" behavior with defense-in-depth.

## The Four Tiers

| Tier | Who Sets It | Access | Can Escalate | Has UI |
|------|-------------|--------|-------------|--------|
| **Puppy** | User (manual or auto-detect) | Read-only, plan only | No | ✅ |
| **Dog** | User (default) | Starts read-only (configurable) | Yes, via permission prompt | ✅ |
| **Ally** | Quest tool (automatic) | Job whitelist only | Never — hard ceiling | ❌ |
| **Dragon** | User (manual only) | Full power | N/A (already max) | ✅ |

### Tier Details

**Puppy** — unchanged from current. Read-only planning mode. Safe bash allowed, mutations prompt. Complexity auto-detect can switch Dog → Puppy.

**Dog** — unchanged from current. Default user mode. Read-only tools auto-allowed, others prompt for permission. Session-scoped overrides. Complexity auto-detect active.

**Ally** — NEW. Set automatically when a quest ally is spawned. Tool whitelist comes from the ally's job profile (defined by hoard-allies). No prompting — allowed tools execute, everything else is silently blocked. Ally can NEVER escalate to Dragon. The ally doesn't even know Dragon mode exists.

**Dragon** — unchanged from current. Full power, no prompts. Manual activation only (`/dragon` or `Ctrl+Alt+D`). Primary session only — quest-spawned allies can never enter Dragon mode.

### Hard Constraints

1. **Ally → Dragon is impossible.** Deterministic enforcement. Not "discouraged," not "requires confirmation" — *impossible*. The code path does not exist.
2. **Only the primary session can be in Dragon mode.** If `HOARD_GUARD_MODE=ally` is set, Dragon mode commands/shortcuts are no-ops.
3. **Ally whitelist is the ONLY allowed set.** No session overrides, no "allow once," no escalation. The whitelist is the whitelist.

---

## Ownership Boundary

| Concern | Owner | Mechanism |
|---------|-------|-----------|
| "What tools does a scout get?" | **hoard-allies** | `JOB_TOOLS` map in quest-tool.ts |
| "Pass the whitelist to the guard" | **hoard-allies** | Env vars on spawn |
| "Enforce the whitelist at execution" | **dragon-guard** | Ally mode in tool_call handler |
| "Block escalation to Dragon" | **dragon-guard** | Mode transition rules |

hoard-allies doesn't know HOW guard enforces restrictions. dragon-guard doesn't know WHAT a kobold scout is. They communicate via env vars — a clean, stable interface.

---

## Mechanism

### Quest Tool (hoard-allies/spawn.ts)

When spawning an ally, set two env vars:

```typescript
env: {
  ...process.env,
  HOARD_GUARD_MODE: "ally",
  HOARD_ALLY_TOOLS: JOB_TOOLS[combo.job],  // e.g., "read,grep,find,ls,bash"
}
```

### Dragon-Guard (index.ts)

On startup, check env vars:

```typescript
const guardMode = process.env.HOARD_GUARD_MODE;
const allyTools = process.env.HOARD_ALLY_TOOLS;

if (guardMode === "ally" && allyTools) {
  // Enter Ally mode — parse tool whitelist, lock it in
  setAllyMode(allyTools.split(",").map(t => t.trim()));
  // Disable all mode-switching commands/shortcuts
  // Disable guard panel (no UI anyway)
}
```

### Ally Mode Decision Tree

```
tool_call event
├─ Ally Mode?
│  ├─ Tool in ally whitelist? → allow immediately
│  ├─ Tool is "bash"?
│  │  ├─ "bash" in ally whitelist? → allow (job trusts bash)
│  │  └─ "bash" not in whitelist? → block
│  └─ Otherwise → block (silent, no prompt)
└─ [existing Dog/Puppy/Dragon logic unchanged]
```

No bash command classification in Ally mode — if the job includes `bash`, all bash is trusted. The job definition is the authority, not pattern matching.

### Mode Transition Rules

```
From       → To         Allowed?
─────────────────────────────────
Puppy      → Dog        ✅ (user command)
Puppy      → Dragon     ✅ (user command)
Dog        → Puppy      ✅ (user command or auto-detect)
Dog        → Dragon     ✅ (user command)
Dragon     → Dog        ✅ (user command)
Dragon     → Puppy      ✅ (user command)
Ally       → Puppy      ❌ (blocked)
Ally       → Dog        ❌ (blocked)
Ally       → Dragon     ❌ (blocked)
Ally       → Ally       ❌ (no reconfiguration)
*          → Ally       ❌ (only via env var at process start)
```

Ally mode is set at process birth and cannot be changed. Period.

---

## Configuration Changes

### New Settings

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `hoard.guard.allyStrictBlock` | bool | `true` | In Ally mode, log blocked tool calls to stderr (debugging) |

### Removed Behavior

- `PI_SUBAGENT_DEPTH` bail-out is removed. Replaced by Ally mode.
- If `HOARD_GUARD_MODE` is NOT set and `PI_SUBAGENT_DEPTH > 0`, fall back to current behavior (bail out) for backward compat with non-hoard subagent tools.

---

## Implementation Plan

### Phase 1: hoard-allies spawn changes
1. Add `HOARD_GUARD_MODE=ally` and `HOARD_ALLY_TOOLS=<tools>` to spawn env
2. Remove `PI_SUBAGENT_DEPTH` from spawn (if it was being set)
3. ~5 lines changed in spawn.ts

### Phase 2: dragon-guard Ally mode
1. Read `HOARD_GUARD_MODE` and `HOARD_ALLY_TOOLS` env vars on startup
2. Add Ally mode to state (new mode value, ally whitelist)
3. Update tool_call decision tree: check Ally mode first
4. Disable mode-switching commands/shortcuts in Ally mode
5. Skip guard panel, footer, auto-detect in Ally mode
6. Update mode transition logic to block Ally → anything

### Phase 3: UI updates
1. Footer shows `[ALLY MODE]` with distinct color (if UI exists, which it won't for allies — but just in case)
2. `/guard` command shows "Ally Mode — locked" if in ally mode
3. Guard panel shows read-only view of ally whitelist (if panel is somehow visible)

### Phase 4: Testing
1. Quest a scout → verify read-only tools work, write tools blocked
2. Quest a coder → verify write tools work
3. Attempt mode switch inside ally → verify blocked
4. Verify Dog/Puppy/Dragon behavior unchanged for primary session

---

## What This Gives Us

**Defense-in-depth:** Two independent layers enforce tool restrictions. `--tools` limits what the LLM can ask for. Ally mode limits what actually executes. Both have to agree.

**Deterministic security:** Ally mode has no prompts, no overrides, no escalation. The whitelist is computed from the ally's job definition and locked at process birth. There is no code path from Ally to Dragon.

**Clean separation:** hoard-allies defines ally capabilities. dragon-guard enforces them. They communicate via env vars, not imports.

**Backward compat:** Non-hoard subagents (using `PI_SUBAGENT_DEPTH`) still bail out as before. Only quest-dispatched allies get Ally mode.
