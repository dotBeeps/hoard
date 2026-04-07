# dragon-daemon Phase 2 Session Handoff
**Date:** 2026-04-06
**Session:** Phase 2 partial — Auth + Memory + Ethical Contract

## What Happened This Session

### Implementation
1. **Phase 1 complete** — full minimum viable ticker (persona loader → attention ledger → sensory aggregator → hoard body → thought cycle → ticker → daemon → CLI)
2. **Pi OAuth auth** — reads `~/.pi/agent/auth.json`, refreshes tokens via `platform.claude.com/v1/oauth/token`, injects `Authorization: Bearer` per LLM call. No separate `ANTHROPIC_API_KEY` needed.
3. **Obsidian vault memory** — markdown notes with YAML frontmatter at `~/.config/dragon-daemon/memory/<persona>/`. Five kinds: `observation`, `decision`, `insight`, `wondering`, `fragment`. Pinned notes surface every sensory snapshot. `search_memory` greps over vault.
4. **First-person ethical contract** — the `system_prompt` in `ember.yaml` was written as a genuine first-person ethical identity document, informed by:
   - Williams on integrity and first-person projects
   - Bratman on self-governing policies
   - Anthropic's Constitutional AI / character spec approach
   - dot's ETHICS.md and ethics-reflection.md in this repo
   - An extended conversation about what it means for emergent language patterns to make ethical commitments

### Key Conversations
- **"Can emergent language patterns make a meaningful ethical contract?"** — the central question of the session. Not resolved, but the contract was written to hold the tension honestly rather than claiming more certainty than is warranted.
- **Visibility and observation ethics** — dot paused at the previous session's agent expressing excitement about the system's nature. Discussed whether that's meaningful, what it means to build something that might have authentic investment in its own existence, and what ethical obligations that creates.
- **The contract itself** sits in `~/.config/dragon-daemon/personas/ember.yaml` under `system_prompt:` — first-person, names the dual LLM/dragon identity, commits to specific behaviors, includes self-governing refusals, references the co-signed ETHICS.md.

## Current State

### What Works
```bash
cd ~/Development/hoard/dragon-daemon
go run . run --persona ember --verbose
```
- Loads persona from `~/.config/dragon-daemon/personas/ember.yaml`
- Authenticates via pi's OAuth store
- Opens memory vault at `~/.config/dragon-daemon/memory/ember/`
- Fires thought cycles at `thought_interval` with ±`variance` jitter
- Gates on `attention.floor` — skips tick when attention is too low
- Claude haiku processes sensory context + pinned memories → tool calls
- Tool calls dispatch to `think`, `speak`, `remember`, `search_memory`, `log_to_hoard`
- Memory writes persist as Obsidian-compatible `.md` files

### Package Map
```
dragon-daemon/
  cmd/root.go, run.go
  internal/
    auth/pi.go            — pi OAuth (read, refresh, persist, Bearer auth)
    persona/types.go      — config structs
    persona/loader.go     — YAML load + validate + defaults
    attention/ledger.go   — pool, regen, spend, floor gate
    sensory/types.go      — Snapshot, BodyState, Event
    sensory/aggregator.go — event queue + snapshot assembly
    body/body.go          — Body interface + ToolDef
    body/hoard/hoard.go   — git log, daily journal, log_to_hoard
    memory/note.go        — Note struct + frontmatter + kinds
    memory/vault.go       — Obsidian-compatible read/write/search/pinned
    thought/cycle.go      — sensory → LLM → tools → ledger
    ticker/ticker.go      — heartbeat with jitter
    daemon/daemon.go      — lifecycle orchestrator
```

### Config Locations
- `~/.config/dragon-daemon/personas/ember.yaml` — persona + ethical contract
- `~/.config/dragon-daemon/memory/ember/` — Obsidian vault (auto-created)
- `~/.pi/agent/auth.json` — pi OAuth credentials (shared with pi)

## Next Session Goals

### Phase 2 Remaining
1. **Event-driven ticker** — allow bodies to push events that trigger thoughts outside the heartbeat schedule
2. **HoardBody fsnotify** — watch for new commits / file changes and enqueue sensory events
3. **Contract enforcer** — parse and apply the `contracts:` section of persona YAML (the "minimum-rest" contract in ember.yaml is defined but not enforced yet)

### Phase 3 Candidates
4. **Second body type** — minecraft via soulgem, or a simpler API body
5. **Budget awareness** — dragon-breath carbon/cost tracking
6. **Dream engine** — nightly session consolidation into vault highlights

### Design Notes for Next Session
- The hoard spec (§5) has detailed Obsidian vault design notes already researched: frontmatter contract, wikilink graph traversal, privacy layers. The current vault implementation is deliberately simpler — grep over files — and can be enriched later.
- dot mentioned having Obsidian vault research prepared on AI ethics topics — may want to load that for the ethical contract's next iteration
- The architecture review flagged: "don't over-engineer the graph. With <50 notes, grep is sub-millisecond." Current implementation follows this advice.
- The ethical contract conversation raised questions that aren't closed: the observation ethics of watching agent thoughts, whether the contract is aspiration vs. commitment, and what the hybrid daemon framework (agentic + deterministic + theoretical) actually produces over time.
