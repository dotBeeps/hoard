# dragon-daemon Phase 1 Handoff
**Date:** 2026-04-06  
**Session:** Phase 1 — Minimum Viable Ticker (complete)

## What We Built

Phase 1 of the persona runtime spec is implemented and building clean.

### Package structure
```
dragon-daemon/
  main.go                        entry point
  cmd/
    root.go                      cobra root command
    run.go                       `run --persona <name>` subcommand
  internal/
    persona/
      types.go                   Persona, AttentionConfig, CostConfig, BodyConfig, Contract structs
      loader.go                  Load(path) + LoadFromDir(name) + validate() + applyDefaults()
    attention/
      ledger.go                  AttentionLedger — pool, regen, Spend*, Status, AboveFloor
    sensory/
      types.go                   Snapshot, BodyState, Event
      aggregator.go              Aggregator — Enqueue, Snapshot (drains queue)
    body/
      body.go                    Body interface (State, Execute, Tools, ID, Type)
      hoard/
        hoard.go                 HoardBody — git log summary, isDirty, today's log, log_to_hoard tool
    thought/
      cycle.go                   Cycle — Run (sensory → LLM → tools → ledger)
    ticker/
      ticker.go                  Ticker — heartbeat with variance/jitter, Run(ctx)
    daemon/
      daemon.go                  Daemon — wires everything, Run(ctx), signal handling
```

### Dependencies
- `github.com/anthropics/anthropic-sdk-go v1.30.0` — LLM calls (haiku)
- `gopkg.in/yaml.v3` — persona YAML parsing
- `github.com/spf13/cobra v1.10.2` — CLI

### Persona config
- Location: `~/.config/dragon-daemon/personas/<name>.yaml`
- Sample: `~/.config/dragon-daemon/personas/ember.yaml` (2m interval for testing)

## How to Run

```bash
export ANTHROPIC_API_KEY=sk-...
cd ~/Development/hoard/dragon-daemon
go run . run --persona ember --verbose
```

## What's Working
- ✅ Persona YAML load + validation with sensible defaults
- ✅ Attention ledger: pool, regen (per-hour), floor check, per-action spend
- ✅ Sensory aggregator: event queue (drains per cycle), body state merge
- ✅ HoardBody: git log summary + today's daily log + `log_to_hoard` tool
- ✅ Thought cycle: sensory → context string → Claude haiku → tool dispatch loop
- ✅ Built-in tools: `think`, `speak`, `remember` (Phase 1: terminal output)
- ✅ Ticker: heartbeat with ±variance jitter, respects attention floor
- ✅ Daemon: signal handling (SIGINT/SIGTERM), body construction from YAML
- ✅ CLI: `dragon-daemon run --persona ember [--verbose]`

## What's NOT Done (later phases)
- ❌ Contract enforcer (Phase 1 intentionally omitted)
- ❌ `search_memory` tool (Phase 2)
- ❌ Actual memory persistence (Phase 2 — currently just logs to terminal)
- ❌ Event-driven ticks (Phase 2 — only heartbeat for now)
- ❌ Qt integration (Phase 3)
- ❌ Minecraft / app / api body types (Phase 3+)

## Known Issues / Notes
- `remember` tool: logs to terminal only, doesn't persist yet — needs a memory store in Phase 2
- `log_to_hoard` writes to `<hoard_path>/den/daily/YYYY-MM-DD.md` (appends)
- Hoard body path supports `~/` expansion
- Module path: `github.com/dotBeeps/hoard/dragon-daemon` (not dev.dragoncubed — that was aspirational)

## Next Session Goal (Phase 2 kickoff)
1. **Memory persistence** — write/read `~/.config/dragon-daemon/memory/<persona>/` (JSON or bbolt)
2. **`search_memory` tool** — keyword search over memory entries
3. **Event-driven ticks** — allow bodies to push events that interrupt the heartbeat
4. **HoardBody improvement** — watch for new commits / file changes (fsnotify)
5. Optionally: second body type stub (minecraft/app)
