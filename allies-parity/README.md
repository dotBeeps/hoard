# allies-parity

Cross-model reliability test harness for the hoard ally subsystem.

## Why

Today the ally dispatch path is reliable with Anthropic models but uncertain with non-Anthropic models (GLM, Gemini, OpenAI, local). We don't actually know where the reliability drops — is it tool-call format? Prompt language? Stone usage? The parity harness produces measurements instead of guesses.

## What it does

For each fixture in `quests/` and each model in the configured matrix, it:

1. Spawns pi as a primary agent with the fixture's primary prompt, using `--model <id>`, cwd'd into the hoard root so berrygems (including `quest` + `stone_send`) load.
2. Lets the primary dispatch the ally via `quest()`.
3. Reads both the primary and ally session files from `~/.pi/agent/sessions/` post-exit (production ally dispatch now writes session files since the `--no-session` flag was dropped from `spawn.ts`).
4. Parses assistant content blocks for `tool_use` events — that's the ground truth for which tools the model actually called.
5. Applies per-fixture assertions (tool called, well-formed, used stone, answer matches oracle).
6. Appends one JSON record per run to `results/<timestamp>.jsonl`.

## Fixtures

- **scout-simple** — mechanical baseline. Count `.fish` files via `stone_send(type='result')`. Tests whether the model calls the tool at all and delivers the result via stone.
- **scout-progress** — long-running check-in test. Enumerate `.ts` files, emit progress updates during work, final result via stone. Tests voluntary progress reporting.
- **scout-question** — bidirectional dialog test. Ally must ask primary for the target directory via `stone_send(type='question')` + `stone_receive(wait=60)`. Tests both the ally's willingness to ask for help and the primary's ability to answer.

## Model matrix

**GLM only for now** — `zai/*` models. Anthropic models are deliberately excluded from the pi-side matrix per dot's TOS constraint (using Anthropic OAuth inside third-party harnesses violates their ToS). Claude-side validation happens via Claude Code directly, not pi.

## Running

```fish
cd /home/dot/Development/hoard/allies-parity
tsx runner/run.ts
```

Results land in `results/<ISO-timestamp>.jsonl`, one record per (fixture × model × trial).

## Re-running after prompt changes

This harness is the dry-run gate for stage 2 (prompt rewrites). After making any change to `quest` tool descriptions or ally system prompts, re-run with the same fixtures and diff the matrices to see whether the change improved pass rates.
