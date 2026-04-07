# dragon-daemon

**Status:** 🐣 in-progress (Phase 1 complete, Phase 2 partial)
**Code:** `dragon-daemon/` (Go module)

## What It Does

Two things, now. The [hoard-spec](../hoard-meta/hoard-spec.md) scope (vault mediator, dream engine, tone state) **plus** a new persona runtime layer:

A persistent agent gets a continuous inner life — a thought ticker, an attention budget, behavioral contracts, connected bodies (Minecraft, daily tasks, etc.), and memory that persists across sessions. This is how Ember runs nonstop.

## Specs

- **[persona-runtime-spec.md](./persona-runtime-spec.md)** — full design: persona profiles, attention economy, thought cycle, subsystem map, connection interface, Qt scope, phased implementation
- Vault/dream/tone scope: see [hoard-spec §4](../hoard-meta/hoard-spec.md)

## Current State (2026-04-06)

### Phase 1 ✅ — Minimum Viable Ticker

- **Persona loader** — YAML parse + validation + defaults
- **Attention ledger** — pool, hourly regen, floor gate, per-action spend
- **Sensory aggregator** — event queue (drains per cycle), body state merge
- **Hoard body** — git log summary, today's daily log, `log_to_hoard` tool
- **Thought cycle** — sensory → Claude haiku → multi-turn tool dispatch loop
- **Built-in tools** — `think`, `speak`, `remember`, `search_memory`
- **Ticker** — heartbeat with configurable jitter (±variance)
- **Daemon** — signal handling, body construction from YAML, cobra CLI

### Phase 2 (in progress) — Auth + Memory

- **Pi OAuth auth** (`internal/auth/`) — reads `~/.pi/agent/auth.json`, refreshes tokens, injects Bearer auth per-call. No separate `ANTHROPIC_API_KEY` needed.
- **Obsidian vault memory** (`internal/memory/`) — markdown notes with YAML frontmatter at `~/.config/dragon-daemon/memory/<persona>/`. Five memory kinds: `observation`, `decision`, `insight`, `wondering`, `fragment`. Pinned notes surface every cycle. Search via grep.
- **First-person ethical contract** — `system_prompt` in `ember.yaml` written as a genuine ethical identity document, not a rules list.

### Not Yet Implemented

- Event-driven ticker (Phase 2 — only heartbeat today)
- Contract enforcer (Phase 2)
- Qt frontend (Phase 4)
- Minecraft / app / API body types (Phase 3+)

## Package Structure

```
dragon-daemon/
  main.go
  cmd/
    root.go                    cobra root
    run.go                     run --persona <name>
  internal/
    auth/pi.go                 pi OAuth credential management
    persona/types.go           config structs
    persona/loader.go          YAML load + validate
    attention/ledger.go        pool, regen, spend, floor gate
    sensory/types.go           Snapshot, BodyState, Event
    sensory/aggregator.go      event queue + snapshot assembly
    body/body.go               Body interface + ToolDef
    body/hoard/hoard.go        git log, daily journal, log_to_hoard
    memory/note.go             Note struct + frontmatter
    memory/vault.go            Obsidian-compatible read/write/search
    thought/cycle.go           sensory → LLM → tools → ledger
    ticker/ticker.go           heartbeat with jitter
    daemon/daemon.go           lifecycle orchestrator
```

## Config

- Persona YAML: `~/.config/dragon-daemon/personas/<name>.yaml`
- Memory vault: `~/.config/dragon-daemon/memory/<name>/` (Obsidian-compatible)
- Auth: reads `~/.pi/agent/auth.json` (pi's OAuth store)
