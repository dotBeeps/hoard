---
name: hoard-sending-stone
description: Send and receive messages between pi sessions via the hoard sending stone — a local HTTP/SSE communication bus. Use when you need to message another agent, ask for help, report results, or check in on allies.
license: MIT
compatibility: "Designed for Pi (pi-coding-agent)"
---

# Sending Stone — Cross-Agent Communication

The sending stone is a local message bus that lets pi sessions talk to each other. The primary session runs an HTTP server; all other sessions connect as clients. Allies subscribe to the SSE stream for bidirectional dialog.

## Quick Reference

### Sending a message (any session)

```typescript
const stone = (globalThis as any)[Symbol.for("hoard.stone")];
if (stone) {
  await stone.send({
    from: "your-name",
    type: "question",
    addressing: "primary-agent",
    content: "Short message here",
  });
}
```

### When to call home

- You're **genuinely stuck** — tried your own tools first, still blocked
- You need a **decision** that isn't yours to make
- You have a **result** to report (quest tool handles this automatically)
- You want to **report progress** at a natural milestone

### When NOT to call home

- Minor issues you can work around
- Every individual tool call (too noisy)
- Asking permission for things in your job whitelist

## Message Format

**Always lead with a concise 1-2 liner:** what you're trying to do and what's blocking you. Only send longer explanations in follow-up messages if asked.

Good:
> "Trying to fetch Node.js IPC docs via defuddle but getting a 403. Should I try curl instead?"

Bad:
> "I was attempting to research inter-process communication mechanisms for Node.js and I started by trying to use the defuddle tool to fetch the documentation page at nodejs.org/api/net.html but unfortunately the server returned a 403 Forbidden status code which means..."

## Addressing

Messages use role-based addressing so the stone works for any hoard configuration.

| Value | Who sees it |
|-------|-------------|
| `"primary-agent"` | The primary agent running the session (e.g. Ember) |
| `"user"` | The user at the keyboard (e.g. dot) |
| `"guild-master"` | The quest coordinator (e.g. Maren), when running |
| `"session-room"` | Everyone — broadcast to all subscribers |
| ally defName | Direct message to a specific ally (e.g. `"wise-griffin-researcher"`) |

### Examples

```typescript
// Ask the primary agent for help
stone.send({ from: "my-name", type: "question", addressing: "primary-agent",
  content: "defuddle is 403ing on nodejs.org. Alternate approach?" });

// Report a result to the room
stone.send({ from: "my-name", type: "result", addressing: "session-room",
  content: "Research complete. HTTP/SSE recommended for local IPC." });

// Ask the user directly
stone.send({ from: "my-name", type: "question", addressing: "user",
  content: "Found two approaches. Want me to pick, or should I present both?" });

// Message a specific ally
stone.send({ from: "my-name", type: "status", addressing: "wise-griffin-coder",
  content: "Recon done — passing findings to you for implementation." });
```

## Message Types

| Type | When to use | Triggers agent turn? |
|------|-------------|---------------------|
| `question` | You need help or a decision | ✅ Yes |
| `result` | Task complete, here's what you found/built | ✅ Yes |
| `status` | Frozen/stuck alerts, important status changes | ✅ Yes |
| `progress` | Regular check-in heartbeats, milestone updates | ❌ No (renders when possible) |

## Receiving Messages

Allies automatically subscribe to the primary's SSE stream and can receive messages in two ways:

### 1. Explicit Polling — `stone_receive` tool

Use after sending a question to wait for a reply:

```
stone_send("Found two candidate files. Which should I focus on?", type: "question")
stone_receive(wait: 60)  ← blocks up to 60s for reply
→ "📨 From Ember (status): focus on types.ts"
```

Parameters:
- `wait` — max seconds to wait (default: 30, max: 120)
- Polls at 200ms intervals
- Returns immediately if messages already pending
- Returns "No messages received" message on timeout

### 2. Passive Injection — tool_result hook

Pending stone messages are automatically appended to any tool result (except `stone_receive`). This catches messages that arrive between tool calls without the ally explicitly polling:

```
read("types.ts")  → file contents + "📨 Incoming message from Ember: check spawn.ts too"
```

### TypeScript API (globalThis)

```ts
const stone = (globalThis as any)[Symbol.for("hoard.stone")];
if (stone) {
  // Subscribe to messages (works in both primary and ally sessions)
  const unsubscribe = stone.onMessage((msg) => {
    // msg: { id, from, addressing, type, content, metadata?, timestamp }
  });

  // Send a message
  await stone.send({
    from: "my-extension",
    type: "status",
    addressing: "primary-agent",
    content: "Hello from my extension",
  });

  // Get the server port
  const port = stone.port();
}
```

All sessions subscribe to SSE. Messages are broadcast to all — each session filters by `addressing`.
- Ally sessions accept: messages to their defName or `"session-room"`
- Primary sessions accept: all messages

## @ Mentions & Urgency

Include `@Name` or `@everyone` in a stone message to mark it urgent. The stone detects the `@` pattern and sets `metadata.urgent: true` automatically.

```typescript
// Urgent direct message
stone_send("@Fizz stop researching, we found the answer already", to: "session-room")
// → metadata.urgent: true, Fizz highlighted in content

// Urgent broadcast
stone_send("@everyone hold — the approach changed, stand by for new instructions", to: "session-room")
// → metadata.urgent: true, everyone highlighted
```

**Rendering:** Urgent messages get a warm red-orange border (instead of dim), a ⚡ badge in the header, and `@mentions` highlighted bold in the content.

**Ally behavior:** Allies are instructed to treat urgent messages as "drop what you're doing" signals. Non-urgent stone chatter is background context they can engage with or ignore.

## Primary Agent Patterns

The primary agent (e.g. Ember) should use the stone **actively but not aggressively** during quests:

**Do:**
- Send a brief direction when dispatching — set context, not micromanage
- Respond when allies ask questions — they're waiting on you
- Use `@Name` when something genuinely needs immediate attention
- Acknowledge good work — allies have personalities and appreciate it
- Redirect if an ally is going down the wrong path

**Don't:**
- Send check-in messages every 15 seconds — that's what the heartbeat is for
- Repeat instructions allies already have
- Hover — trust the ally to do their job and report back
- Use `@everyone` for non-urgent updates

**Tone by tier:**
- Kobolds: warm and direct. They're eager to please. Clear tasks, let them scurry.
- Griffins: collaborative. They'll push back if they disagree. Trust their judgment.
- Dragons: peer conversation. Ask, don't command.

## Heartbeat Pulse

During active quests, the quest coordinator sends a `⏱ {time}` message to the session room every ~15 seconds. This gives all participants passive time awareness without anyone needing to check a clock. Allies can use it to gauge how long they've been working. It's background context — no one needs to respond to it.

## Architecture

```
Primary (Ember)          Subagent (ally)          Guild-master (Maren)
  HTTP server ◄──POST── stone client    ◄──POST── stone client
  SSE stream ──────────► SSE listener   ──────────► SSE listener
  stone_send tool        stone_send tool           stone_send tool
                         stone_receive tool
                         tool_result injection
```

- Server starts automatically in primary session
- Port passed to allies via `HOARD_STONE_PORT` env var
- Ally identity via `HOARD_ALLY_DEFNAME` env var
- All communication is local (`127.0.0.1`), no auth
- Messages are structured JSON (`StoneMessage` type)
- Ally SSE connections cleaned up on `session_shutdown`
