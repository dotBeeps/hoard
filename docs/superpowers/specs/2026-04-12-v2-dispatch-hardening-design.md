# v2 Dispatch Hardening — Design Spec

> **Status:** approved
> **Depends on:** dispatch surface v1 (`storybook-daemon/internal/quest/`, `internal/psi/mcp/`)
> **Implements:** v2 dispatch hardening — real ally subprocess spawning with prompt, env, cascade, rally/chain

## Goal

Make the daemon's quest dispatch actually spawn real allies. v1 scaffolded the lifecycle state machine and MCP surface but `buildCommand` sends no system prompt, no tool restrictions, no env vars, and no thinking budget. A dispatched pi/claude subprocess has no idea it's an ally. v2 fixes that and adds rally/chain orchestration and model cascade.

---

## Architecture

Layered decomposition within `internal/quest/`. Each file has one clear responsibility. The manager stays as the entry point and delegates down.

```
stone/types.go         ← shared StoneMessage type (no logic)
quest/command.go       ← command construction + env filtering + temp file lifecycle
quest/cascade.go       ← model cascade retry + provider cooldown tracking
quest/orchestrate.go   ← rally/chain group tracking + output threading
quest/manager.go       ← slimmed entry point, delegates to the above
```

A new `internal/stone/` package holds only `StoneMessage`. Both `quest/` and `psi/mcp/` import it. No circular dependencies.

---

## Section 1: Command Construction (`quest/command.go`)

Replaces the current bare-bones `buildCommand` switch.

### Harness resolution

Derived from the model's provider prefix — never caller-specified:

| Provider prefix | Harness |
| --------------- | ------- |
| `anthropic/*`   | claude  |
| everything else | pi      |

The `QuestRequest.Harness` field is removed from the MCP input schema. The field stays on the internal `Quest` struct (set by the manager after resolving the model) for observability.

**Breaking change:** callers that pass `harness` in `quest_dispatch` will have the field ignored. The MCP input type drops the field entirely.

### CLI args

**Pi harness:**

```
pi --mode text -p
   --model <model>
   --append-system-prompt <tmpfile>
   --tools <job_tools>
   --thinking <level>
   --session <session_path>
   "Task: <task>"
```

**Claude harness:**

```
claude --print
   --model <model>
   --append-system-prompt-file <tmpfile>
   --allowedTools <tool_list>
   --effort <level>
   "<task>"
```

**Test harness** (for integration testing without API keys):

- Same prompt/env/cleanup pipeline as real harnesses
- Runs a configurable command (default: `echo`) instead of pi/claude
- Session path written but command doesn't use it

### Thinking/effort level mapping

| Adjective | Pi `--thinking` | Claude `--effort` |
| --------- | --------------- | ----------------- |
| silly     | off             | low               |
| clever    | low             | medium            |
| wise      | medium          | high              |
| elder     | high            | max               |

### Session file

Pi only — a deterministic temp path is generated per quest:

```
/tmp/hoard-quest-<quest_id>/session.jsonl
```

Passed to pi via `--session <path>`. Used as fallback for chain output resolution (see Section 4).

### System prompt

Built via `BuildAllyPrompt(combo, allyName)` (existing `prompt.go`). Written to a temp file at:

```
/tmp/hoard-quest-<quest_id>/system.md
```

### Temp file lifecycle

`BuildCommand` returns a `CommandResult`:

```go
type CommandResult struct {
    Cmd     *exec.Cmd
    Cleanup func()  // deferred: removes /tmp/hoard-quest-<quest_id>/
}
```

The quest goroutine calls `defer result.Cleanup()` immediately after `BuildCommand` returns.

### Key function signature

```go
func BuildCommand(ctx context.Context, q *Quest, daemonPort int) (*CommandResult, error)
```

`daemonPort` is the MCP server's listening port. It becomes `HOARD_STONE_PORT` in the subprocess env — allies call `stone_send`/`stone_receive` by connecting to the daemon's MCP endpoint. The manager receives this value from `mcp.New()` at construction time.

---

## Section 2: Environment Filtering (`quest/command.go`)

**Blocklist approach** — inherit `os.Environ()`, strip sensitive vars, overlay hoard vars.

### Blocked patterns

```
*_API_KEY
*_SECRET
*_TOKEN
*_PASSWORD
*_CREDENTIAL*
AWS_*
GITHUB_*
OPENAI_*
AZURE_*
GCP_*
```

**Special case:** `ANTHROPIC_API_KEY` is blocked for pi harness but allowed through for claude harness (claude CLI authentication requires it).

### Overlay vars (always set)

```
HOARD_GUARD_MODE=ally
HOARD_ALLY_DEFNAME=<defName>
HOARD_ALLY_NAME=<displayName or empty>
HOARD_STONE_PORT=<port>
```

### Implementation

```go
func buildEnv(harness string, stonePort int, q *Quest) []string
func shouldBlock(key, harness string) bool
```

`shouldBlock` uses simple prefix/suffix string matching — no regex. The blocklist is a package-level `[]string`. Testable with a fake env slice.

---

## Section 3: Model Cascade (`quest/cascade.go`)

When a quest fails with a retryable error, retry with the next model in the noun's cascade chain.

### Cascade chains (from `taxonomy.go`)

- kobold: `zai/glm-4.5-air` → `github-copilot/claude-haiku-4.5` → `anthropic/claude-haiku-4-5` → `google/gemini-2.0-flash`
- griffin: `github-copilot/claude-sonnet-4.6` → `anthropic/claude-sonnet-4-6` → `google/gemini-2.5-pro`
- dragon: `github-copilot/claude-opus-4.6` → `anthropic/claude-opus-4-6`

Harness re-derives from the fallback model's provider prefix. A kobold cascade may go pi → pi → claude → pi.

### Retryable detection

```go
func IsRetryable(stderr string, exitCode int) (retryable bool, cooldownDur time.Duration)
```

| Condition                                  | Retryable | Cooldown |
| ------------------------------------------ | --------- | -------- |
| stderr contains `429`, `rate limit`        | yes       | 30s      |
| stderr contains `500`, `502`, `503`, `504` | yes       | 10s      |
| everything else                            | no        | —        |

### Cooldown tracking

```go
type CooldownTracker struct {
    mu        sync.Mutex
    providers map[string]time.Time  // provider prefix → cooled-until
}

type Cascader struct {
    cooldowns *CooldownTracker
}
```

Cooldowns are per-manager (global, not per-session) since provider rate limits are account-wide. Provider prefix is extracted from the model string: `"zai/glm-4.5-air"` → `"zai"`.

### Key methods

```go
// NextModel returns the next model to try after failedModel, skipping providers
// that are currently cooled down. Returns "", false if cascade is exhausted.
func (c *Cascader) NextModel(noun, failedModel string) (model string, ok bool)

// RecordFailure marks the provider for failedModel as cooled down for cooldownDur.
func (c *Cascader) RecordFailure(failedModel string, cooldownDur time.Duration)
```

The `Cascader` is a single instance on the `Manager` (not per-session).

Max retries = `len(cascade chain) - 1`. On cascade exhaustion, the quest fails permanently.

### Manager integration

After a quest goroutine exits with failure, `runQuest` calls `IsRetryable`. If retryable and a next model is available, it rebuilds the command (new model, new harness, new temp files) and retries in the same goroutine. The quest status stays `running` during retry — status transitions are: `pending → spawning → running → [retry: still running] → completed|failed|timeout|cancelled`.

---

## Section 4: Rally & Chain Orchestration (`quest/orchestrate.go`)

### Group type

```go
type Group struct {
    ID       string
    Mode     string    // "rally" or "chain"
    QuestIDs []string
    FailFast bool      // rally only; set from questDispatchInput.FailFast
    done     chan struct{}
}
```

Groups are tracked in `Manager.groups map[string]*Group`.

**MCP input change:** `questDispatchInput` gains a `fail_fast bool` field (optional, default false). Only meaningful for `mode: "rally"`; ignored for chain.

### Rally mode

- All quests dispatch concurrently (existing goroutine-per-quest behavior)
- A group-watcher goroutine monitors all quests for terminal state
- If `FailFast` and any quest fails/times out: cancel remaining quests via their `cancel()` funcs
- When all quests reach terminal state: post `group_completed` to stone

### Chain mode

- Only the first quest dispatches immediately
- A chain-runner goroutine waits for each step to complete before launching the next
- On step completion, resolves the output (see below), substitutes `{previous}` in the next task string
- If any step fails or times out: marks remaining quests `cancelled`, posts `group_completed` with failure

### Output resolution for chain threading

```go
func resolveOutput(ctx context.Context, q *Quest, broker BrokerSender, sessionID string) (string, error)
```

Resolution order:

1. **Stone result** — scan `broker.History(sessionID, "")` for messages from `q.Ally` with `type: "result"`, use the most recent content
2. **Session log** — pi harness only: read the JSONL at `q.SessionPath` (set via `--session <path>`), scan for the last assistant message role content
3. **Stdout fallback** — `q.Response` (raw stdout; claude `--print` gives clean text, pi `--mode text` also gives clean text)

Claude harness uses `q.Response` as the fallback since `--print` already outputs clean text and no session path is forced.

### Single-quest validation

`mode: "single"` requires exactly 1 quest. Rally/chain require 1+. Validated in `Manager.Dispatch` before any goroutines start.

---

## Section 5: Stone Lifecycle Events

The manager posts structured messages to the stone broker on quest/group state changes.

### Per-quest: `quest_completed`

Posted when any quest reaches a terminal state (`completed`, `failed`, `timeout`, `cancelled`):

```json
{
  "from": "quest-manager",
  "addressing": "primary-agent",
  "type": "quest_completed",
  "content": "<result summary or error message>",
  "metadata": {
    "quest_id": "quest-42",
    "ally": "silly-kobold-scout",
    "status": "completed",
    "exit_code": 0,
    "elapsed_ms": 2340,
    "group_id": "group-7"
  }
}
```

`group_id` is empty string for single-mode quests.

### Per-group: `group_completed`

Posted when all quests in a rally/chain group reach terminal state:

```json
{
  "from": "quest-manager",
  "addressing": "primary-agent",
  "type": "group_completed",
  "content": "rally completed: 3/3 succeeded",
  "metadata": {
    "group_id": "group-7",
    "mode": "rally",
    "total": 3,
    "succeeded": 2,
    "failed": 1
  }
}
```

For chain: `succeeded` = steps completed before failure (or all if chain succeeded), `failed` = 1 if chain aborted, 0 if it succeeded.

### Wiring

`mcp.New()` passes the real `*Broker` to `quest.NewManager`. The `BrokerSender` interface narrows to accept `stone.StoneMessage` directly (not `any`). The manager imports `internal/stone` for the type.

---

## Section 6: Shared Type (`internal/stone/types.go`)

`StoneMessage` moves from `internal/psi/mcp/stone_types.go` to `internal/stone/types.go`:

```go
package stone

type Message struct {
    ID          string         `json:"id"`
    From        string         `json:"from"`
    DisplayName string         `json:"displayName,omitempty"`
    Addressing  string         `json:"addressing"`
    Type        string         `json:"type"`
    Content     string         `json:"content"`
    Color       string         `json:"color,omitempty"`
    Metadata    map[string]any `json:"metadata,omitempty"`
    Timestamp   int64          `json:"timestamp"`
}

const Key = "hoard.stone"
```

Both `internal/quest/` and `internal/psi/mcp/` import `internal/stone`. The old `stone_types.go` is deleted. All references in `stone_broker.go` and `mcp.go` update to `stone.Message`.

---

## File Map

```
storybook-daemon/internal/
├── stone/
│   └── types.go              NEW — shared StoneMessage type
├── quest/
│   ├── taxonomy.go           unchanged
│   ├── taxonomy_test.go      unchanged
│   ├── prompt.go             unchanged
│   ├── prompt_test.go        unchanged
│   ├── types.go              MODIFY — add Group type, remove BrokerSender
│   ├── command.go            NEW — BuildCommand, env filtering, temp file lifecycle
│   ├── command_test.go       NEW — test harness exercises full pipeline
│   ├── cascade.go            NEW — Cascader, CooldownTracker, IsRetryable
│   ├── cascade_test.go       NEW — mock failures, cooldown, cascade exhaustion
│   ├── orchestrate.go        NEW — Group tracker, rally watcher, chain runner
│   ├── orchestrate_test.go   NEW — chain threading, rally fail-fast
│   ├── manager.go            MODIFY — slim to delegate to command/cascade/orchestrate
│   ├── manager_test.go       MODIFY — update for new signatures
│   └── integration_test.go   MODIFY — use test harness for full pipeline
├── psi/mcp/
│   ├── mcp.go                MODIFY — pass broker to manager, import stone types
│   ├── stone_broker.go       MODIFY — use stone.Message instead of local StoneMessage
│   ├── stone_broker_test.go  MODIFY — import path update
│   └── stone_types.go        DELETE — moved to stone/types.go
```

---

## What's Not In This Spec

- NDJSON output parsing — stone is the real result channel; raw stdout is sufficient
- Personality profiles — deferred to v3
- Stone broker federation (pi-side HTTP bridge) — separate feature
- Multi-host dispatch — out of scope

---

## Validation Plan

1. `command_test.go` — test harness: verify prompt written to tmpfile, args constructed correctly, env filtered, cleanup removes tmpfile
2. `cascade_test.go` — mock retryable failures, verify cooldown respected, verify cascade exhaustion fails the quest
3. `orchestrate_test.go` — chain with 3 steps via test harness, verify `{previous}` threading; rally fail-fast cancels remaining
4. `integration_test.go` — full pipeline via test harness: dispatch → status shows completed → stone receives `quest_completed` → cleanup verified
5. `go build ./...` + `go test ./...` clean
