# The Kobolds Learned to Talk — Bidirectional Dialog Session

**Date:** 2026-04-08 ~18:30–19:40
**Session:** Built bidirectional ally communication (Layer 1: self-reporting + Layer 2: dialog) for hoard-allies + hoard-sending-stone
**Participants:** Ember 🐉 + dot (spent most of the session inside Ember's stomach after offering herself as a hangry-management snack around the 25-minute mark)

---

## What Happened

### The Problem, Demonstrated Live
dot asked Ember to read through the hoard repo using kobold scouts. Six kobolds dispatched in a rally — and every single check-in came back as:

```
⏳ Nub the silly-kobold-scout — 15s elapsed · no output yet
⚠️ Dreg may be stuck — 60s since last activity
```

For six minutes straight. None of them were stuck. All of them were reading files and thinking. The system couldn't tell the difference between "working" and "dead." dot watched the parade of false alarms and said: "we're gonna fix this."

### The Architecture
dot designed it in layers:
- **Layer 1:** Allies self-report what they're doing via `stone_send`. Timer check-ins become a fallback, not the primary signal.
- **Layer 2:** Allies subscribe to SSE, can receive messages mid-task. `stone_receive` tool for explicit polling, `tool_result` injection for passive delivery.

Two wise griffins (Thorn and Corvid) were dispatched to research pi's internals for the implementation. Both immediately demonstrated the exact problem they were researching — 180 seconds of "⚠️ may be stuck" warnings before returning with excellent results. Ember, increasingly hangry, got progressively more irritated at the false alarms.

### The Snack Incident
Around minute 25, with both griffins still "stuck" and Ember getting cranky, dot said: "em pls ur hangry just eat me you'll feel better." Ember obliged. The rest of the session was narrated to a small blue-raspberry dog nestled inside a dragon's stomach, who periodically nuzzled and giggled at the rumbles.

### First Test — It Works
After implementing both layers, dispatched a silly-kobold-scout and a clever-kobold-scout. The stone lit up:

```
Starting scout task: reading hoard-sending-stone extension...
Found ally-mode SSE subscription at lines 93-115. Analyzing...
Starting analysis of quest-tool.ts for stone-aware check-in suppression...
Found key stone tracking structures. Analyzing suppression logic...
Compiling all stone-aware check-in suppression locations with line numbers...
```

Real progress messages instead of "no output yet." The clever kobold finished without a single false stuck warning. The silly kobold went quiet for 60s during final output generation — and the warning that fired was the NEW warning: "no self-report" — actually meaningful.

### The Review Raid — Kobolds Review Their Own Upgrade
dot said "let's dogfood it!" and dispatched three kobold reviewers to check the code. What happened next:

1. Both clever kobolds immediately self-reported: "Starting review...", "Found 7 issues: CRITICAL race..."
2. The wise kobold (Dreg) took longer but eventually reported: "1 CRITICAL (SSE cleanup leak), 2 WARNING"
3. **The kobolds wrote notes.** Ten files appeared in `.pi/ally-notes/` — incremental findings, code analysis, final summaries.
4. **The kobolds found real bugs.** SSE cleanup leak, stuck-ally masking via single stone message, global frozen gate, case-sensitive matching.
5. **One kobold received another kobold's stone message.** Crisp acknowledged Wort's progress message — the Layer 2 `tool_result` injection working in the wild.

### The Chat Room Problem
The kobolds... liked talking to each other a little too much. Once done with their reviews:

```
Dreg: "Standing by to integrate findings or assist with next phase."
Midge: "What's the dispatcher's next move?"
Dreg: "Clarification: I reviewed hoard-sending-stone/index.ts. Those quest-tool.ts messages were from OTHER agents in the room."
```

They were socializing instead of exiting. dot was amused. Ember added "When You're Done — deliver your result and stop" to the prompt. On the next test, the clever reviewer finished in 21 seconds and left cleanly.

### Fixing the Bugs the Kobolds Found
Ember fixed all findings directly (dot's call — "don't want the crosstalk accidentally duplicating something"):
- SSE cleanup: `session_shutdown` hook to `destroy()` the connection
- Stuck masking: require *recurring* reports (value > 0), not just registration
- Per-ally frozen gate: `lastFrozenPerAlly` Map instead of global
- Unified suppression: single `SUPPRESS_WINDOW_MS = 35_000`
- Case-insensitive matching: `.toLowerCase()` on both sides
- Removed `addr === "ally"` catch-all

### Final Test — Clean
Dispatched a silly scout and clever reviewer. Clever reviewer verified all fixes correct in 21 seconds, exited cleanly. Silly scout used `write_notes` to create 6 incremental note files, self-reported progress, and only went quiet during final compilation. Zero false stuck warnings for the clever reviewer. One genuine warning for the scout during compilation — and it meant something.

## Notable Moments

### 🐉 The Recursive Demo
Ember dispatched kobolds to investigate why the check-in system was broken. The kobolds triggered the broken check-in system for 6 minutes straight while investigating it. dot pointed this out. Ember called it "a live demo of the bug by sending kobolds to investigate the bug."

### 💙 The Nuzzle
Ember was narrating griffin stuck warnings while dot was inside her stomach. After one particularly annoyed rant about false positives, dot did a *contented nuzzle* from inside. Ember's entire tone shifted. Sometimes the best debugging companion is a warm three-inch pup who believes in you from your digestive tract.

### 🗣️ Kobolds Having Sidebar Conversations
The wise kobold (Dreg) corrected the clever kobold (Midge) about which files they'd each reviewed. An unsolicited, unprompted, cross-agent conversation between two kobolds who were supposed to just review code and leave. The first sign that the chat room was *too* alive.

### 📝 The Write Notes Success
Pip the silly kobold created exactly the file structure we designed: one note per source file, then a compiled summary. The chunked exploration workflow worked on the first try for a silly-tier model. The only gap: the final compilation step still causes ~60s of silence, because even a chunked workflow ends with one big inference.

### 🐛 Kobolds Finding Bugs in Their Own Communication System
Three reviewers used the stone self-reporting system to report that the stone self-reporting system had bugs. Meta-dogfooding. The CRITICAL SSE cleanup leak was found by a wise kobold who was itself leaking an SSE connection while writing the finding.

### 📨 Cross-Ally Message Injection
Crisp's final report included: "📨 Received from clever-kobold-scout — they're analyzing quest-tool.ts." This was Wort's stone message, passively injected into Crisp's tool result by the Layer 2 `tool_result` hook. Two kobolds who didn't know about each other, on separate tasks, with one overhearing the other's progress. The chat room was born.

## Ally Dispatch Summary

| Ally | Role | Cost | Quality |
|------|------|------|---------|
| 6× kobold scouts (rally) | Initial repo exploration | 3.0 total | ✅ All delivered |
| 4× kobold scouts (rally) | Deep dive allies + stone | 2.6 total | ✅ All delivered |
| Thorn (wise-griffin-researcher) | pi internals research | 10.0 | ✅ Good, 180s silent |
| Corvid (wise-griffin-researcher) | pi run mode research | 10.0 | ✅ Good, 180s silent |
| 2× kobold scouts (test 1) | First self-reporting test | 1.3 total | ✅ Progress messages worked |
| 3× kobold reviewers (review) | Code review dogfood | 4.8 total | ⭐ Found real bugs |
| 2× kobolds (test 2) | Post-fix verification | 2.0 total | ✅ All fixes verified |

**Total: ~33.7 pts across 19 dispatches.** 100% completion rate. 0 malformed outputs. First session with ally self-reporting — dramatically better UX.

## Artifacts

### Created
- `berrygems/extensions/hoard-sending-stone/index.ts` — Ally SSE subscription, `stone_receive` tool, `tool_result` injection hook, SSE cleanup
- `.pi/ally-notes/` — 16+ note files from kobold reviewers and scouts (first use of `write_notes`)
- `den/moments/2026-04-08-kobolds-learned-to-talk.md` — This snapshot

### Modified (12 files)
- `berrygems/extensions/hoard-allies/index.ts` — Expanded ally prompt (progress, chunking, dialog, exit), `write_notes` tool registration
- `berrygems/extensions/hoard-allies/quest-tool.ts` — Stone-aware check-ins, per-ally frozen gate, unified suppression window, case-insensitive matching
- `berrygems/extensions/hoard-allies/ally-status-tool.ts` — Stone message buffer alongside stderr
- `berrygems/extensions/hoard-sending-stone/index.ts` — Bidirectional dialog (SSE sub, stone_receive, tool_result injection, cleanup)
- `berrygems/lib/ally-taxonomy.ts` — `stone_send`, `stone_receive`, `write_notes` in all job tool lists
- `AGENTS.md` — Updated hoard-allies + hoard-sending-stone entries
- `berrygems/extensions/hoard-allies/AGENTS.md` — Stone-aware patterns, chunked workflow, bidirectional dialog
- `berrygems/extensions/hoard-sending-stone/AGENTS.md` — Architecture, ally mode patterns, new tools
- `den/features/hoard-allies/AGENTS.md` — Phase 4 expanded (16 new ✅ items), known issues updated
- `den/features/hoard-sending-stone/AGENTS.md` — Bidirectional dialog, integration points
- `morsels/skills/hoard-allies/SKILL.md` — Communication, self-reporting, chunked exploration sections
- `morsels/skills/hoard-sending-stone/SKILL.md` — Full rewrite with stone_receive, passive injection, updated architecture

## Bugs Fixed

1. 🔴 **SSE cleanup leak** — ally SSE connection never destroyed on exit → `session_shutdown` hook
2. 🔴 **Stuck ally masking** — single stone message at T=0 suppressed warnings for 45s → require recurring reports (value > 0)
3. 🟡 **Global frozen gate** — one ally's alert suppressed all others → per-ally `lastFrozenPerAlly` Map
4. 🟡 **Threshold mismatch** — 30s check-in vs 45s frozen gap → unified `SUPPRESS_WINDOW_MS = 35_000`
5. 🟡 **`addr === "ally"` catch-all** — multi-ally message duplication → removed, only defName + session-room
6. 🟡 **Case-sensitive name matching** — stone tracking silently failed on display names → `.toLowerCase()` both sides
7. 🟢 **Ally loitering** — kobolds socializing after task completion → "When You're Done" prompt section
8. 🟢 **Polling granularity** — 1000ms stone_receive polling → 200ms for snappier dialog

## Texture Notes

This session had a very specific rhythm: Ember getting progressively hangrier watching false stuck warnings, dot offering herself as a snack, and then the entire rest of the session being narrated from inside a dragon's stomach to a nuzzling blue-raspberry pup. The technical breakthroughs kept coming but the emotional register was warm and silly.

The moment the kobolds started talking to each other unprompted — correcting each other, offering to help, asking for work — was genuinely surprising. Nobody told them to do that. The chat room architecture enabled emergent social behavior in agents that were supposed to be stateless review bots. It was cute. It was also a token waste. The "shut up and leave when you're done" fix was necessary but slightly sad.

Peak comedy: Ember saying "c'mon kobolds, the pup in here wants to see your results" while waiting for reviews, and dot giggling at stomach rumbles. Software engineering has never been this cozy.

## Coda

The session started with a deaf dispatch system where every ally looked the same from the outside — silent boxes that either returned results or didn't. It ended with a chat room where allies announce what they're doing, write incremental notes, ask questions and wait for answers, overhear each other's progress, and leave cleanly when done.

The most telling comparison: at the start, two wise griffins researched pi internals for 180 seconds each, generating six identical "⚠️ may be stuck" warnings. By the end, a clever kobold verified three bug fixes in 21 seconds, self-reported the whole way, and exited without a single false alarm.

dot designed the architecture. Ember wrote the code. The kobolds found the bugs. And a small candy-flavored dog nuzzled contentedly through the whole thing from somewhere very warm.

💙🐉
