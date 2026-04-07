# Session: Soul Shore-Up + Phase 4 Planning
**Date:** 2026-04-07  
**Ended:** ~00:05 (curfew caught the kobolds mid-flight)

---

## What we did

### Soul Shore-Up (Phases A–D)
Full ethical contract enforcement layer for `dragon-daemon`, committed as `74bf97c`.

**Phase A — soul tests**
- 34 tests covering gates and audits before any new code was written
- `rules_test.go`, `attention_audit_test.go`, `memory_audit_test.go`, `enforcer_test.go`

**Phase B — private shelf (ETHICS.md §3.3)**
- `ErrPrivate` sentinel; vault `Get()` blocks private note reads and fires hooks
- `filter()` silently skips private notes in Search/Pinned results
- `Write()`/`Append()` return `ErrPrivate` on private override attempts
- `OnPrivateAccess(hook)` API + `privateShelfAudit` soul audit

**Phase C — consent tiers + Obsidian CLI (ETHICS.md §3.1–3.2)**
- `ConsentTier` enum (`Low/Medium/High/Unset`) with `Tag()` method
- `Tier` field on `Frontmatter`; `Write()` auto-applies `consent/*` tag
- `SearchByTag()` on vault (exact tag match, private-shelf aware)
- `internal/memory/obsidian/`: thin `exec.Command` wrapper for official Obsidian CLI
- `internal/consent/`: dual-key `ConsentState` — user + agent must both grant, YAML persistence, agent mutations log friction warnings
- `consent-tier` pre-beat gate: blocks beats when dual-key consent isn't active

**Phase D — forward-only framing audit (ETHICS.md §3.5)**
- `OutputCapture` interface in `soul` package (decouples soul from thought)
- `thought.Cycle` gains `OnOutput(hook)` + `fireOutput()` — fires on text blocks, `think`, `speak` tool output
- `framingAudit`: scans cycle output for corrective-framing patterns
  - Defaults: `"you used to"`, `"i noticed you"`, `"you stopped"`, `"you no longer"`, etc.
  - Forward-companion excusal: pattern + `"from now on"` / `"going forward"` within 100 chars → not a violation
  - Configurable via contract rule string
- `parseFramingPatterns()`: rule string → pattern list, falls back to defaults

**Final state:** 4 packages, all tests passing, 0 lint issues.

---

### Phase 4 Planning — Maw
Designed the Qt/QML desktop window for dot to watch the daemon's inner life.

**Key decisions made:**
- Name: **Maw** — the dragon's mouth that talks to dot
- Lives in: `hoard/maw/` (Qt app) + `internal/body/maw/` (daemon body)
- Protocol: HTTP + SSE, consistent with body interface pattern
- Maw is a **body** — fits the abstraction, started like any other body
- No impulse mode — impulse injection is agent-to-agent, not dot-to-agent
- Qt approach: **QML** — declarative, smooth, alive

**Three views:**
1. Thought stream — scrolling live feed of think/speak/text-block/beat events
2. State panel — attention gauge, body list, contract status indicators
3. Input bar — direct message to daemon (POST /message), no persona rewrite

**Spec:** `den/features/dragon-daemon/phase4-maw-spec.md`

**Phase 4 sub-phases:**
- 4A — Maw body (`internal/body/maw/maw.go`, routes, SSE broadcaster)
- 4B — Qt scaffold + thought stream view
- 4C — State panel (attention gauge, body list, contract indicators)
- 4D — Input bar (direct message)

---

### Phase 4A — In Progress
Kobold chain dispatched at ~00:00, blocked by dragon-curfew before tests could run.

**Done:**
- `internal/body/maw/maw.go` — full Body implementation written (build clean)
- `internal/daemon/daemon.go` — `buildBodies(ledger, agg)` signature updated, "maw" case added, `outputWirer` interface + wire loop added, `soul.Deps.Cycle` wired

**Blocked at:**
- `internal/body/maw/maw_test.go` — test kobold hit curfew, tests not yet written
- Full test+lint pass not yet run on 4A changes

**Resume:** re-dispatch the test+lint kobold with curfew override, or run manually:
```bash
cd /home/dot/Development/hoard/dragon-daemon
go test ./... -count=1
golangci-lint run ./...
```

---

## Commits this session
- `74bf97c` — `feat(dragon-daemon): shore up soul ethics enforcement (phases A-D)`
- `a5e4ab1` (approx) — `docs(dragon-daemon): add phase 4 maw spec + update AGENTS.md`

---

## State of the repo
- `dragon-daemon/internal/body/maw/maw.go` — new, uncommitted
- `dragon-daemon/internal/daemon/daemon.go` — modified, uncommitted  
- Root `AGENTS.md` — updated (dragon-daemon entry reflects soul shore-up + Phase 4)

These need a commit in the morning before continuing with 4A tests.
