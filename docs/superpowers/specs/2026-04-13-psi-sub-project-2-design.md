# psi Sub-Project 2: Full Daemon Participation

**Date:** 2026-04-13
**Status:** Design approved, pending implementation plan
**Scope:** storybook-daemon conversation ledger + psi Qt app dual-connection MCP client

## Summary

psi (the Qt 6/QML desktop app) currently connects to the daemon's SSE interface only — it watches the thought stream and sends raw text messages. Sub-project 2 makes psi a full daemon participant by adding an MCP client connection alongside SSE, enabling stone message participation, quest visibility, memory access, and persistent conversational context across beats.

## Approach

**Dual Connection (SSE + MCP)** — psi connects to both daemon interfaces simultaneously. SSE for the thought stream (already working). MCP for everything else: session registration, stone send/receive, memory search/read, quest dispatch/status, and rich attention state. Zero daemon API changes — uses existing interfaces as-is.

Why this over alternatives:

- **Expand SSE** was rejected because it duplicates MCP capabilities and requires the stone broker to move out of the MCP interface or be bridged.
- **Unified interface** was rejected because it's an infrastructure rewrite that breaks existing pi/CC integrations for no immediate gain.

## Architecture

### Connection Model

```
psi (Qt 6)                          storybook-daemon
├── SseConnection (existing)  ←→    SSE psi (:7432)
│   ← GET /stream (thoughts)          - thought broadcast
│   → POST /message (nudge heart)     - sensory event injection
│   ← GET /state (attention)          - attention pool
│
└── McpClient (new)           ←→    MCP psi (:9432)
    → register_session                 - session identity
    → stone_send / stone_receive       - stone bus participation
    → memory_search / memory_read      - vault access
    → quest_dispatch / quest_status    - ally management
    → attention_state                  - rich attention info
```

### Startup Sequence

1. `SseConnection.connectToServer(:7432)` — existing, thought stream starts
2. `McpClient.connect(:9432)` — new
3. `McpClient.registerSession("psi-ember", "ui", "direct", "psi")` — new
4. `McpClient.startStonePolling("psi-ember")` — new, long-poll loop filtering `addressed_to` for both `"psi-ember"` (direct) and `"session-room"` (broadcast)
5. UI ready — thoughts streaming, stone messages arriving, full API available

### Message Routing

- **dot's text messages** still go through `POST /message` on SSE — this is the only path that creates sensory events and nudges the dragon-heart. MCP has no inbound event path to the thought cycle.
- **Stone messages** (ally results, quest events) arrive via `stone_receive` MCP long-poll.
- **Thoughts** arrive via SSE `/stream` as before.

## Conversation Ledger (Daemon-Side)

### Problem

Today, messages from dot are one-shot sensory events. The aggregator drains them into the thought cycle snapshot, and they're gone. The next beat has no memory of the conversation. There is no persistent conversational context.

### Solution

A new `internal/conversation` package providing a `Ledger` — an in-memory sliding window of conversational exchanges that compacts into the existing memory vault when the token budget overflows.

### Ledger Design

```go
type Entry struct {
    Role    string    // "dot", "ember", "ally:Grix", "system"
    Content string
    Source  string    // "sse", "mcp", "stone", "thought"
    At      time.Time
}

type Summary struct {
    VaultKey string    // "conversation/2026-04-13-1432"
    OneLiner string    // "discussed test failures, dispatched Grix"
    From     time.Time
    To       time.Time
}

type Ledger struct {
    mu          sync.Mutex
    entries     []Entry
    summaries   []Summary
    tokenCount  int
    tokenBudget int            // from persona config
    vault       *memory.Vault  // the SAME vault the persona uses
    log         *slog.Logger
}
```

### Append Sources

| Source                           | Role                        | Trigger                                   |
| -------------------------------- | --------------------------- | ----------------------------------------- |
| SSE `POST /message`              | `"dot"`                     | SSE handler, alongside sensory event push |
| Thought cycle `speak` tool       | `"ember"` (or persona name) | `dispatchTool()` in cycle.go              |
| Stone broker `result`/`question` | `"ally:{from}"`             | MCP stone_send handler                    |
| Quest lifecycle                  | `"system"`                  | Quest manager completion events           |

### Token Budget & Compaction

- **Budget**: configurable per persona YAML (`conversation_budget: 2000` tokens, ~8K chars)
- **Estimation**: ~4 chars/token heuristic, no tokenizer dependency
- **Trigger**: when `tokenCount > tokenBudget`, compact oldest ~40% of entries
- **Compaction**:
  1. Take oldest ~40% of entries
  2. Format as transcript
  3. Write to vault via `vault.Write(key, KindJournal, transcript, ["conversation", "auto-compacted"], false, TierUnset)`
  4. Generate heuristic one-liner summary
  5. Store `Summary{VaultKey, OneLiner, From, To}` in live window
- **Summary pruning**: summaries section capped at ~200 tokens. Oldest summaries dropped (vault notes remain — only in-memory references are trimmed)

### Vault Integration

Compacted segments use the existing vault system:

- `KindJournal` — the kind for auto-generated entries, already used by memory-transparency audit
- `WriteHook` fires on `vault.Write()` — the dragon-soul memory-transparency audit automatically journals every compacted segment
- `SearchByTag("conversation")` — any MCP client or the persona itself can query conversation history
- Obsidian-compatible — compacted notes are browsable markdown files with YAML frontmatter
- Privacy/consent enforcement applies — standard vault rules

### LLM Context Injection

The thought cycle's `buildContextMessage()` renders the ledger between pinned memories and nerve states:

```
## Recent Conversation

Earlier (in vault):
- [14:10–14:25] discussed test failures, dispatched Grix → conversation/2026-04-13-1410
- [14:25–14:31] reviewed findings, fixed 2 type errors → conversation/2026-04-13-1425

Recent:
[14:32] dot: nice work! can you check if the build passes?
[14:32] ember: checking the build...
[14:33] ember: *observes hoard nerve* build is green! all 47 tests passing.
[14:33] dot: perfect, let's commit
[14:34] ally:Grix: (result) all 47 tests pass, no regressions
```

The persona can `search_memory` for a vault key to recall full detail from compacted segments.

### Lifecycle

- **Graceful shutdown**: compact all remaining entries to vault
- **Restart**: ledger starts empty (v1). Compacted segments remain searchable in vault. Future: rehydrate summaries from `SearchByTag("conversation")` with time filter.

## psi Qt App Changes

### New C++ Classes

**McpClient** (`src/mcpclient.{h,cpp}`)

- HTTP client for MCP Streamable HTTP (JSON-RPC over `POST /mcp`)
- Methods: `registerSession()`, `stoneSend()`, `stoneReceive()`, `memorySearch()`, `memoryRead()`, `questStatus()`, `attentionState()`
- Signals: `connectedChanged()`, `sessionRegistered()`, `requestError(QString)`
- Properties: `connected` (bool), `sessionId` (QString)
- Uses `QNetworkAccessManager` — MCP Streamable HTTP is just HTTP POSTs with JSON-RPC

**StonePoller** (`src/stonepoller.{h,cpp}`)

- QThread running `stone_receive` long-poll loop
- Polls with `wait_ms=60000`, `addressed_to` filtering for `"session-room"` + `"psi-ember"`
- Signal: `messageReceived(QVariantMap)` — emitted cross-thread via queued connection
- Reconnects on error with exponential backoff (reuses SseConnection pattern)

**ConversationModel** (`src/conversationmodel.{h,cpp}`)

- QAbstractListModel replacing ThoughtModel
- Roles: `EntryType`, `Role`, `Content`, `Timestamp`, `Source`, `AllyName`, `VaultKey`
- EntryType enum: `Thought`, `DotMessage`, `StoneMessage`, `QuestEvent`, `Summary`
- Slots: `addThought(type, text)`, `addDotMessage(text)`, `addStoneMessage(QVariantMap)`, `addSummary(timeRange, oneLiner, vaultKey)`
- Properties: `count`, `autoScroll` (carried from ThoughtModel)

### New QML Components

**ConversationStream.qml** — replaces ThoughtStream. ListView over ConversationModel with `DelegateChooser` selecting delegate by EntryType. Summary entries render as collapsible headers at top. Auto-scroll behavior carried from ThoughtStream.

**DotMessageDelegate.qml** — blue-tinted background bubble, right-indented. Timestamp + content.

**StoneDelegate.qml** — green accent left border, ally name colored by tier (kobold/griffin/dragon from ThemeEngine). Message type badge (result/progress/question).

**QuestEventDelegate.qml** — compact single line, muted system-event style. "quest: wise-kobold-scout completed (42s)".

**SummaryDelegate.qml** — collapsed italic header with left border. Time range + one-liner. Vault key as tooltip or secondary text.

### Modified QML Components

**Main.qml** — swap ThoughtStream → ConversationStream. Wire new context properties (`Mcp`, `Conversation`).

**ConnectionBar.qml** — dual SSE/MCP status indicators. Session ID display. Graceful degradation: if MCP disconnects, stone/quest/memory features are unavailable but thought stream still works.

**InputBar.qml** — on send: add entry to ConversationModel immediately (optimistic display), then POST to SSE `/message` as before.

**StatePanel.qml** — new sections: Active Quests (ally name, job, elapsed time from MCP `quest_status` polling) and Stone (message count, connection status).

**SessionRail.qml** — dynamic persona list. Click to switch active connection pair (SSE + MCP). Each persona tab owns its own ConversationModel and connection state. "+" button for connecting to new personas.

**StreamFilter.qml** — add dot/ally/quest filter toggles alongside existing think/speak/observe/beat.

### Removed

**ThoughtStream.qml** — replaced by ConversationStream. Scroll logic moves there.

**ThoughtModel** — replaced by ConversationModel. ThoughtDelegate.qml is kept and reused inside ConversationStream.

### main.cpp Wiring

```cpp
// New objects
McpClient mcp;
StonePoller stonePoller(&mcp);
ConversationModel conversation;

// SSE thoughts → ConversationModel
connect(&sse, &SseConnection::thoughtReceived,
    [&](QString type, QString text) { conversation.addThought(type, text); });

// Stone messages → ConversationModel
connect(&stonePoller, &StonePoller::messageReceived,
    [&](QVariantMap msg) { conversation.addStoneMessage(msg); });

// MCP connected → register session + start polling
connect(&mcp, &McpClient::connectedChanged, [&] {
    if (mcp.connected()) {
        mcp.registerSession("psi-ember", "ui", "direct", "psi");
        stonePoller.start();
    }
});

// Context properties
ctx->setContextProperty("Mcp", &mcp);
ctx->setContextProperty("Conversation", &conversation);
```

## What Does NOT Change

- SseConnection (C++) — unchanged
- DaemonState (C++) — unchanged
- ThemeEngine (C++) — unchanged
- ThoughtDelegate.qml — reused inside ConversationStream
- Stone broker (daemon) — unchanged, psi is just a new MCP client
- Quest manager (daemon) — unchanged
- SSE interface endpoints — unchanged
- MCP interface tools — unchanged

## Persona Config Addition

```yaml
# In persona YAML (e.g. ember.yaml)
conversation_budget: 2000 # tokens for Recent Conversation context section
```

Default: 2000 tokens (~8K chars). Persona-configurable.

## Summarization Strategy

- **v1**: Heuristic — extract first meaningful content phrase per entry, join, cap at 100 chars. No LLM call, no attention cost.
- **Future**: LLM-assisted summarization with configurable attention cost (`costs.summarize`).

## Testing

### Daemon

- `internal/conversation/ledger_test.go` — table-driven tests:
  - Append and retrieve entries
  - Token budget enforcement triggers compaction
  - Compaction writes KindJournal to vault with correct tags
  - Summary references preserved after compaction
  - Summary pruning when summary budget exceeded
  - Concurrent append safety (mutex)
  - Token estimation accuracy

### psi

- Build verification: `cd psi && cmake -B build && cmake --build build`
- Manual integration test: run daemon + psi, send messages, verify:
  - dot messages appear immediately in ConversationStream
  - Ember's speak responses appear via SSE
  - Stone messages from allies appear via MCP poll
  - Quest events show in StatePanel
  - SessionRail switches between personas
  - MCP disconnect gracefully degrades to SSE-only mode
