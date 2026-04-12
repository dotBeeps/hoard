# Daemon Dispatch Surface — Spec

> **Status:** draft
> **Depends on:** stone broker (see `den/features/hoard-sending-stone/AGENTS.md` Stage 3)
> **Implements:** task #14 from the scope pivot (cut economy → spec dispatch → implement)

## Goal

The daemon becomes a universal ally dispatcher — spawning and managing both `claude` and `pi` subprocesses as allies, replacing the CC-internal Agent tool pattern and unifying dispatch across harnesses.

## Why daemon dispatch wins over CC-internal dispatch

| Factor        | CC Agent tool                         | Daemon dispatch                                     |
| ------------- | ------------------------------------- | --------------------------------------------------- |
| Context       | Subagent shares parent context window | Independent process, own context                    |
| Parallelism   | Sequential (one at a time in CC)      | True concurrent subprocess spawning                 |
| Communication | Return value only (work vanishes)     | Stone broker: bidirectional, persistent             |
| Mixed harness | CC can only spawn CC                  | Daemon spawns `claude` or `pi`                      |
| Lifecycle     | Tied to parent turn                   | Independent — survives parent completion            |
| Observability | Opaque until return                   | Stderr streaming, check-in heartbeats, quest_status |

## MCP Tool Surface

Three new tools replace the existing stubs in `mcp.go`. All are session-scoped — unknown `session_id` returns an error.

### `quest_dispatch`

Spawn one or more allies as subprocesses. Returns immediately with quest IDs. Results arrive via stone.

```typescript
// Input
{
  session_id: string,
  mode: "single" | "rally" | "chain",  // dispatch mode
  quests: [{
    ally: string,           // defName: "silly-kobold-scout", "clever-griffin-coder", etc.
    task: string,           // natural language task description
    harness: "claude" | "pi",  // which binary to spawn
    model?: string,         // override model (default: from ally taxonomy noun tier)
    timeout_ms?: number,    // per-quest timeout (default: from job defaults)
    thinking?: string,      // thinking budget: "low" | "medium" | "high" (pi only)
  }]
}

// Output
{
  status: "dispatched",
  group_id: string,         // shared ID for the dispatch group (chain/rally/single)
  quests: [{
    quest_id: string,       // unique ID for tracking
    ally: string,           // defName echoed back
    harness: string,
    model: string,          // resolved model
    pid?: number,           // OS process ID (null for chain steps not yet spawned)
  }]
}
```

**Mode behavior:**

- `single` — quests array must have exactly 1 entry. Spawns immediately.
- `rally` — all entries spawn concurrently. Group completes when all finish (or any fails, depending on `fail_fast` flag).
- `chain` — entries spawn sequentially. Each step's task may contain `{previous}` which is replaced with the prior step's response. Chain aborts on first failure.

**Behavior:**

- Each quest entry spawns an independent subprocess
- All quests in a single call launch concurrently (fan-out)
- Quest results are delivered via `stone_send` to the requesting session
- Dispatch returns immediately — caller uses `quest_status` or `stone_receive` to track

**Subprocess construction:**

For `harness: "pi"`:

```
pi --mode json -p --model <model> --append-system-prompt <tmpfile> \
   --tools <job_tools> [--thinking <budget>] "Task: <task>"
```

Env: `HOARD_GUARD_MODE=ally`, `HOARD_ALLY_DEFNAME`, `HOARD_ALLY_NAME`, `HOARD_STONE_PORT`

For `harness: "claude"`:

```
claude --print --model <model> --system-prompt <tmpfile> \
   --allowedTools <tool_list> "<task>"
```

Env: `HOARD_ALLY_DEFNAME`, `HOARD_ALLY_NAME`, `HOARD_STONE_PORT`

**System prompt:** Built from ally taxonomy (adjective × noun × job) using the same `buildAllyPrompt()` logic currently in hoard-allies. The daemon needs a Go port of the prompt builder, or it can shell out to a thin TS script that prints the prompt.

### `quest_status`

Check status of one or more quests dispatched by this session.

```typescript
// Input
{
  session_id: string,
  quest_ids?: string[],    // omit to get all quests for this session
}

// Output
{
  quests: [{
    quest_id: string,
    ally: string,
    harness: string,
    model: string,
    status: "pending" | "spawning" | "running" | "completed" | "failed" | "timeout" | "cancelled",
    pid: number,
    started_at: string,     // ISO 8601
    finished_at?: string,
    elapsed_ms: number,
    exit_code?: number,
    result_summary?: string, // first 500 chars of response (if completed)
    error?: string,
    last_stderr?: string,    // most recent stderr line (if running)
    stone_messages: number,  // count of stone messages from this ally
  }]
}
```

### `quest_cancel`

Kill a running quest subprocess.

```typescript
// Input
{
  session_id: string,
  quest_id: string,
}

// Output
{
  status: "cancelled" | "not_found" | "already_finished",
  quest_id: string,
}
```

**Behavior:** Sends SIGTERM, waits 5s, then SIGKILL if still alive. Updates quest status to `"failed"` with error `"cancelled by user"`.

## Internal Architecture

### Quest Manager

New package: `internal/quest/` — owns subprocess lifecycle, separate from MCP layer.

```go
// quest/manager.go

type Manager struct {
    mu      sync.Mutex
    quests  map[string]*Quest      // quest_id → quest
    bySession map[string][]string  // session_id → quest_ids
    logger  *slog.Logger
}

type Quest struct {
    ID        string
    SessionID string
    Ally      string    // defName
    Harness   string    // "claude" | "pi"
    Model     string
    Task      string
    Status    Status    // pending | spawning | running | completed | failed | timeout | cancelled
    PID       int
    StartedAt time.Time
    FinishedAt *time.Time
    ExitCode  *int
    Response  string
    Error     string
    LastStderr string
    StoneCount int
    cmd       *exec.Cmd
    cancel    context.CancelFunc
}

type Status string
const (
    StatusPending   Status = "pending"
    StatusSpawning  Status = "spawning"
    StatusRunning   Status = "running"
    StatusCompleted Status = "completed"
    StatusFailed    Status = "failed"
    StatusTimeout   Status = "timeout"
    StatusCancelled Status = "cancelled"
)
```

**Key methods:**

- `Dispatch(ctx, sessionID, req) ([]QuestInfo, error)` — spawn subprocesses, return immediately
- `Status(sessionID, questIDs) []QuestInfo` — query quest state
- `Cancel(sessionID, questID) error` — kill subprocess
- `Cleanup(sessionID)` — kill all quests for a session (on session disconnect)

### Process Lifecycle

Each quest goroutine:

1. Write system prompt to temp file
2. Build command + env vars
3. Start process with `exec.CommandContext` (context has timeout)
4. Stream stderr line-by-line → update `LastStderr`, detect frozen state
5. Collect stdout → parse response on exit
6. On completion: post result to stone broker, update quest status
7. On timeout: kill process, mark as timeout, post failure to stone
8. Cleanup temp files in `defer`

### Cascade Support

Model cascade lives in the quest manager — if a quest fails with a retryable error (429, 5xx), the manager can retry with the next model in the noun tier's cascade chain. This is transparent to the caller.

Cooldown state is per-manager (not per-session) since provider rate limits are global.

### Integration with Stone Broker

The quest manager holds a reference to the stone broker. On quest completion/failure, it posts a structured result message:

```go
broker.Send(ctx, StoneMessage{
    From:       quest.Ally,
    Addressing: "primary-agent",
    Type:       "result",
    Content:    quest.Response,  // or error message
    Metadata:   map[string]any{"quest_id": quest.ID, "status": quest.Status},
})
```

Running quests can also receive stone messages (ally subprocess calls `stone_send` via MCP), which the broker routes normally.

## Taxonomy Port

The ally taxonomy (adjective × noun × job → defName, model selection, tool lists, prompt) currently lives in TypeScript (`lib/ally-taxonomy.ts`, `hoard-allies/index.ts`). The daemon needs enough of this to:

1. Resolve a defName like `"silly-kobold-scout"` to a model + tool list
2. Build a system prompt for the ally

**Options:**

- **A) Go port** — rewrite taxonomy lookup + prompt builder in Go. ~200 lines. Keeps daemon self-contained.
- **B) TS shim** — `npx ts-node lib/build-ally-prompt.ts <defName>` that prints JSON `{model, tools, systemPrompt}`. Quick but adds Node dependency.
- **C) Static config** — daemon reads a generated `ally-defs.json` at startup. Build step writes it from TS source. No runtime dependency but stale risk.

**Recommendation:** Option A (Go port). The taxonomy is stable, small, and the daemon shouldn't depend on Node at runtime. The prompt template is ~30 lines of string interpolation.

## Files to Add/Modify

```
storybook-daemon/internal/
├── quest/
│   ├── manager.go         — quest lifecycle, subprocess spawn
│   ├── manager_test.go    — table-driven tests (spawn mock, status, cancel, timeout)
│   ├── types.go           — Quest, Status, QuestInfo types
│   ├── taxonomy.go        — Go port of ally taxonomy (defName → model + tools + prompt)
│   └── cascade.go         — model cascade + provider cooldowns
├── psi/mcp/
│   ├── mcp.go             — swap stubs for real handlers, inject quest.Manager
│   ├── stone_broker.go    — (from stone broker spec — ring buffer, subscribe, long-poll)
│   └── stone_types.go     — StoneMessage Go mirror
```

## Session Lifecycle

1. CC session calls `register_session` → session map entry created
2. CC session calls `quest_dispatch` → quests spawned, tracked under session ID
3. Quests run independently, post results via stone
4. CC session calls `quest_status` to check progress
5. CC session calls `stone_receive` to get result messages
6. On session disconnect: `Cleanup(sessionID)` kills orphan quests

## Validation Plan

1. **Unit tests** — `quest/manager_test.go`: dispatch with mock command (`echo` or `sleep`), verify status transitions, cancel mid-run, timeout behavior
2. **Integration test** — spawn a real `pi --mode json` ally with a trivial task, verify result arrives via stone
3. **CC-to-daemon quest** — from a CC session, call `quest_dispatch` for a scout ally, verify `quest_status` and `stone_receive` work end-to-end
4. **Parity with pi-side** — same quest, same ally def, dispatched via daemon vs pi-side spawn.ts → compare output quality

## Not in scope

- Multi-host dispatch (quests always run on same machine as daemon)
- Quest persistence across daemon restarts (ephemeral, like pi-side)
- Economy/budget gates (cut per scope pivot)

## Research-Informed Design Decisions

Patterns adopted from industry research (Claude Code teams, LangGraph, CrewAI, Codex, Devin):

### Explicit state machine (LangGraph pattern)

Quest status uses 7 states with explicit transitions:
`pending → spawning → running → completed|failed|timeout|cancelled`
No implicit state. Every transition logged. State queryable at any time via `quest_status`.

### Chain/rally at orchestrator level (CrewAI flows pattern)

The daemon natively supports chain and rally modes via `quest_dispatch` — the `mode` field selects behavior. Callers don't need to compose multi-step workflows from individual dispatches + manual stone coordination. Output threading via `{previous}` token replacement is built into the daemon.

### Environment filtering (Codex sandbox pattern)

Subprocess environment is explicitly constructed, not inherited. Only these vars are passed:

- `HOARD_GUARD_MODE`, `HOARD_ALLY_DEFNAME`, `HOARD_ALLY_NAME`, `HOARD_STONE_PORT`
- `PATH`, `HOME`, `TERM` (minimal shell requirements)
- `ANTHROPIC_API_KEY` or equivalent (if needed for the harness)
  All other env vars stripped to prevent secret leaks.

### Mathematical frozen detection (2026 consensus)

Don't ask agents if they're stuck. Detect mechanically:

1. No stderr output for 4x check-in interval → frozen warning
2. Hard timeout (non-negotiable, per job type) → kill + mark timeout
3. Future: output token stall detection (same content repeating)

### Direct inter-ally messaging (CC teams mailbox pattern)

Stone broker routes messages between allies by defName without primary as intermediary. Allies in a rally can coordinate directly if needed.
