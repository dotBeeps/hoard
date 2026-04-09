# storybook-daemon — AGENTS.md

> **Part of [Hoard](../AGENTS.md)** — read the root AGENTS.md first for project-wide context.
> **Governed by [ETHICS.md](../ETHICS.md)** — **READ THIS FIRST** before modifying soul, consent, memory, or body code.

## What This Is

**storybook-daemon** is the formless core of the dragon — mind, soul, and connectors. A Go system daemon with an attention-gated thought loop, deterministic ethical contract enforcement, attention economy, and connections to bodies that give it form in the world.

The daemon runs independently of any single pi session. It persists, it remembers (Obsidian-compatible vault), it thinks (attention-gated thought cycles), and it enforces ethics (soul package — deterministic, not advisory).

**Doggy** is the primary interface: a Qt/QML chat client connecting to one or more persona doggy psi interfaces via HTTP+SSE. Each agent gets a chat thread; tool invocations render in dedicated Qt windows. Agents can be proactive (heartbeat-driven) or reactive (message-triggered only).

> **⏸ Proactive ticking deferred** — autonomous heartbeat-driven thought cycles are parked pending LLM provider + auth decisions. Pi OAuth is pi-session-only and does not work in the daemon. Reactive mode (`POST /message` → nudge heart → one thought cycle → SSE stream) is the unblocked path forward.

## Relationship to the Hoard

- **The daemon IS the dragon** without a body. Everything else orbits it.
- **Bodies** (`hoard`, others planned) are external systems the daemon inhabits and senses from — git repos, GitHub, shell.
- **Psi interfaces** (`doggy`, `mcp`) are communication surfaces the daemon exposes to the world — dot's chat window, MCP tool connections. Named after psionics: the channel through which the daemon reaches outward and the world reaches in.
- **berrygems** are tools the dragon uses _through_ her pi body. The daemon doesn't import berrygems — it connects to pi sessions that have berrygems loaded. Berrygems that currently render Pi-specific panels will have native Qt window equivalents in doggy.
- **morsels** are portable knowledge. The daemon's thought cycles may reference morsel-level knowledge, but skills are consumed by the pi body, not the daemon directly.
- **ETHICS.md** is the binding ethical contract. The `soul/` package enforces it deterministically. The `consent/` package manages risk-informed consent tiers. The `memory/` package respects private shelves. **These are not optional.**

## Architecture

```
storybook-daemon/
├── cmd/              Cobra CLI (run --persona <name>)
├── internal/
│   ├── attention/    Budget/economy — collaborative, gamified
│   ├── auth/         OAuth token management (pi integration)
│   ├── body/         Sensory bodies — external systems the daemon inhabits
│   │   ├── hoard/    Hoard-aware body (watches this repo)
│   │   └── github/   GitHub event body (planned)
│   ├── psi/          Psi interfaces — communication surfaces exposed to the world
│   │   ├── doggy/    HTTP+SSE dot interface (chat stream, state, message ingestion)
│   │   └── mcp/      MCP tool server (vault, attention, stone for CC/VSCode/etc.)
│   ├── consent/      Consent state machine — risk tiers (low/med/high), dual-key
│   ├── daemon/       Top-level orchestration, lifecycle
│   ├── heart/        Event-driven ticker — the central thought loop
│   ├── memory/       Obsidian-compatible vault — private shelves, wikilinks
│   ├── persona/      YAML persona loading
│   ├── sensory/      Observation types + queue
│   ├── soul/         Ethical contract enforcement — deterministic gates
│   └── thought/      Thought cycle processing
├── AGENTS.md         ← you are here
├── .golangci.yml     Strict linter config (v2 format)
├── main.go
└── go.mod
```

### Dependency Graph

Clean layered architecture — no circular dependencies:

```
daemon → heart → thought → soul → consent
                        ↘ memory
              → body/* → sensory
              → psi/*  → sensory
              → attention
```

## Ethical Enforcement

The daemon enforces [ETHICS.md](../ETHICS.md) deterministically. Key code-ethics mappings:

| ETHICS.md Section          | Code Package   | Enforcement                                                   |
| -------------------------- | -------------- | ------------------------------------------------------------- |
| §3.1 Risk-informed consent | `consent/`     | State machine with low/med/high tiers                         |
| §3.2 Dual-key consent      | `soul/gate.go` | Both user AND agent toggles required                          |
| §3.3 Private shelves       | `memory/`      | `private: true` blocks injection, traversal, dream processing |
| §3.5 Observation framing   | `sensory/`     | Forward-looking, collaborative framing validated              |
| §3.6 Conservative defaults | `soul/`        | High-risk features default off                                |

## Phase Status

| Phase                | Status | Description                                                                                                                                                                                                 |
| -------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation       | ✅     | Persona loading, fsnotify body, vault memory, basic heart loop                                                                                                                                              |
| 2 — Soul             | ✅     | Consent tiers, private shelves, framing audit, ethical enforcement                                                                                                                                          |
| 2.5 — Soul Shore-up  | ✅     | Private shelf blocking, consent tier determinism, framing patterns                                                                                                                                          |
| 3 — New Bodies + Psi | 🐣     | GitHub body ✅, doggy psi ✅ (HTTP+SSE dot interface), MCP psi ✅ (memory/attention/stone via MCP protocol), multi-persona orchestration ✅ (storybook.go + run-all CLI), pi session + shell bodies planned |
| 4 — Doggy Qt client  | 🥚     | Qt/QML chat client — multi-agent threads, tool windows, attention panel, input bar; berrygem panel tools migrated to native Qt windows; ⏸ proactive ticking blocked on auth                                |

## Attention Economy

The attention system is **collaborative and gamified**. Either party (dot or the agent) can propose raising or lowering attention on bodies, topics, or tasks. Asking is always okay and welcomed.

## Development

```bash
# Lint (strict — 30+ linters)
cd storybook-daemon && golangci-lint run ./...

# Build
cd storybook-daemon && go build -o storybook-daemon .

# Test
cd storybook-daemon && go test ./...

# Run a single persona
cd storybook-daemon && go run . run --persona ember

# Run all personas from ~/.config/storybook-daemon/personas/
cd storybook-daemon && go run . run-all --all

# Run specific personas
cd storybook-daemon && go run . run-all --personas ember,maren
```

See root [AGENTS.md](../AGENTS.md#go-conventions-storybook-daemon) for full Go conventions.

## Detailed Feature Tracking

For per-phase breakdowns, research docs, and implementation details, see:

- [`den/features/storybook-daemon/AGENTS.md`](../den/features/storybook-daemon/AGENTS.md) — current state tracker
- [`den/features/storybook-daemon/persona-runtime-spec.md`](../den/features/storybook-daemon/persona-runtime-spec.md) — full spec
- [`den/features/storybook-daemon/phase4-maw-spec.md`](../den/features/storybook-daemon/phase4-maw-spec.md) — Phase 4 spec
