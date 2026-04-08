# AGENTS.md — hoard-sending-stone

Local HTTP/SSE communication bus for cross-agent messaging between pi sessions.
The primary session owns the server; ally sessions get a send-only client.

## Directory Structure

- `index.ts` — Extension entry point. Detects ally vs primary mode via `HOARD_GUARD_MODE`, starts server, opens SSE stream, registers `stone_send` tool, wires `StoneAPI` onto `globalThis`. Handles `/reload` cleanup.
- `server.ts` — HTTP server with POST `/message` (validates `from` + `content`, fans out to SSE subscribers) and GET `/stream` (SSE). Auto-assigns port when `preferredPort` is 0/undefined.
- `client.ts` — Thin HTTP POST client for ally sessions. Reads port from `HOARD_STONE_PORT` env var. Always fails silently — never throws.
- `renderer.ts` — Bordered message renderer. Truecolor name styling (HSL derivation per tier/name), box-drawing borders, word-wrapping. Registered via `registerStoneRenderer()`.
- `types.ts` — `StoneMessage`, `StoneAPI` interfaces, `STONE_KEY = Symbol.for("hoard.stone")`.

## Shared Lib Dependencies

- `berrygems/lib/settings.ts` — `readHoardSetting()` for `contributor.name`, `stone.maxLines`, `stone.port`

## Cross-Extension Coupling

- `Symbol.for("hoard.stone")` — `StoneAPI` on `globalThis`; consumed by hoard-allies and any extension needing to send/receive messages
- `Symbol.for("hoard.stone.names")` — ally name registry (`Record<string, string>`); populated by hoard-allies, read by renderer for display name resolution
- `HOARD_GUARD_MODE=ally` — triggers client-only path in `index.ts`
- `HOARD_STONE_PORT` — port communicated to ally sessions via env var
- `HOARD_ALLY_DEFNAME` — ally's defName used as the `from` field in stone_send calls
- `~/.pi/hoard-sending-stone.json` — `{ port, pid }` written by primary session; allows late-joining sessions to discover the server

## Patterns to Follow

- Ally mode check is first — `if (process.env["HOARD_GUARD_MODE"] === "ally")` — sets up SSE subscription, message buffer, stone_receive tool, tool_result injection, then returns
- Server validates `from` (string, required) and `content` (string, required) on every POST; 400 on failure
- `stone.port` setting: `0` or `undefined` = auto-assign; otherwise binds to the specified port
- `stone_send` tool schema uses `Type.Union` of four string literals: `"question"`, `"status"`, `"result"`, `"progress"`
- `stone_receive` tool is ally-only — polls `pendingMessages[]` at 200ms interval, max 120s wait
- Rendering logic lives exclusively in `renderer.ts`; `index.ts` only calls `registerStoneRenderer()`
- `Symbol.for("hoard.stone.internals")` holds `{ port, sseReq, handlers }` — survives `/reload` without leaking listeners
- Ally SSE connection stored as `sseRequest` and destroyed on `session_shutdown`
- `tool_result` hook injects pending messages into any tool result EXCEPT `stone_receive` (avoids double-delivery)
- Message filtering in ally mode: accept `addressing === allyDefName || "session-room"`, ignore own messages

## Anti-Patterns

- **DO NOT** parse settings manually — use `readHoardSetting()`
- **DO NOT** add rendering or ANSI logic to `index.ts` — it belongs in `renderer.ts`
- **DO NOT** use raw ANSI escape sequences without checking if `panel-chrome` or `pi-tui` covers the need
- **DO NOT** accept unvalidated POST bodies — always check `from` and `content` before fanOut
- **DO NOT** throw from `client.ts` — ally sessions must degrade silently
