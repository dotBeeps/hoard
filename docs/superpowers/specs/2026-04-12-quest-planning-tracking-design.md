# Quest Planning & Tracking System

> Design spec for incorporating plan/test/develop/review loops into the hoard quest system,
> with the storybook-daemon as persistent orchestrator and markdown files as the state layer.

## Problem

Today the hoard ally system can dispatch work and receive results, but has no concept of
_what work is being done_ beyond "I spawned a process and it finished." There's no task
registry, no persistent plans, no review loops, no cross-session state. The superpowers
skill system proves that structured plan → task → implement → review pipelines dramatically
improve output quality — but that system lives entirely in a single Claude session's context
window and dies when the session ends.

We need the same discipline, owned by the daemon, backed by markdown files that integrate
with Obsidian and graphify.

## Architecture

Three layers, single responsibility each:

```
┌─────────────────────────────────────┐
│  Primary Agent (pi or CC session)   │  architect: writes plans, creates tasks,
│  talks to user, high-judgment work  │  intervenes mid-flight, approves gates
├─────────────────────────────────────┤
│  Storybook Daemon (Go MCP server)   │  foreman: owns task registry, orchestrates
│  persistent, file-backed md state   │  implement→review loops, triggers graphify
├─────────────────────────────────────┤
│  Ally Subagents (pi or CC)          │  hands: execute tasks, report via stone,
│  stateless, scoped, disposable      │  self-report status codes on completion
└─────────────────────────────────────┘
```

**Primary agent** is the architect. It writes plans, decomposes them into tasks, registers
tasks in the daemon one by one, and kicks off execution. It can intervene, reprioritize,
or add tasks mid-flight. High-judgment, conversational work stays here.

**Storybook daemon** is the foreman. It owns the task registry (markdown files on disk),
orchestrates the implement → review loop per task, dispatches allies via the existing quest
system, and reports status back to the primary via stone. It persists across sessions.

**Ally subagents** are hands. They receive task text + context directly in their prompt
(never read plan files themselves), do the work, report via stone, and exit. Stateless
and disposable.

## Task Registry

### Directory Structure

```
quests/
├── plans/
│   └── 2026-04-12-ally-reliability.md
├── tasks/
│   ├── fix-progress-checkin.md
│   ├── add-stone-retry.md
│   └── ...
├── reviews/
│   ├── fix-progress-checkin-spec-review.md
│   └── fix-progress-checkin-quality-review.md
└── index.md                              ← auto-generated
```

Location is configurable via daemon config. Default: `quests/` in the project root.
The directory can be gitignored (ephemeral project tracking) or committed (persistent
record) per user preference.

### Task File Format

```markdown
---
id: fix-progress-checkin
status: pending
plan: "[[2026-04-12-ally-reliability]]"
tier: griffin
review_depth: two_stage
blocked_by: []
assigned_to: null
quest_id: null
created: 2026-04-12T10:00:00Z
updated: 2026-04-12T10:00:00Z
tags: [stone, reliability, glm]
---

# Fix Progress Check-in Reliability

## Task

GLM allies send 1 progress update instead of 2+ in scout-progress fixture.
Root cause likely in prompt language — "send progress updates as you work"
is too vague for non-Anthropic models.

## Acceptance Criteria

- scout-progress fixture passes 3/3 trials on glm-5
- Progress updates >= 2 per run

## Context

- [[2026-04-12-ally-reliability]] section 3
- allies-parity results: `results/2026-04-11T22-56-23.jsonl`
- [[dead-ends#2026-04-12]] for related daemon build gotchas

## Review Notes

<!-- populated by reviewer allies, appended by daemon -->
```

### Frontmatter Fields

| Field          | Type         | Description                                                                                                        |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `id`           | string       | Unique identifier, matches filename stem                                                                           |
| `status`       | enum         | `pending` / `in_progress` / `implementing` / `spec_review` / `quality_review` / `completed` / `failed` / `blocked` |
| `plan`         | wikilink     | Parent plan document                                                                                               |
| `tier`         | enum         | `kobold` / `griffin` / `dragon` — from ally taxonomy                                                               |
| `review_depth` | enum         | `none` / `single` / `two_stage`                                                                                    |
| `blocked_by`   | wikilink[]   | Task IDs that must complete first                                                                                  |
| `assigned_to`  | string?      | Ally defName currently working on this                                                                             |
| `quest_id`     | string?      | Active quest ID in the quest manager                                                                               |
| `created`      | ISO datetime | Creation timestamp                                                                                                 |
| `updated`      | ISO datetime | Last state change                                                                                                  |
| `tags`         | string[]     | Freeform tags for filtering and graph queries                                                                      |

### Status State Machine

```
pending ──→ in_progress ──→ implementing ──→ spec_review ──→ quality_review ──→ completed
  │              │               │               │                │
  │              │               │               │                └──→ implementing (retry)
  │              │               │               └──→ implementing (retry)
  │              │               └──→ failed (max retries)
  │              └──→ blocked (dependency failed)
  └──→ blocked (dependency not met)
```

- `pending`: created, waiting for dependencies or execution kick
- `in_progress`: daemon has picked this up, preparing dispatch
- `implementing`: ally is actively working
- `spec_review`: implementer done, spec reviewer dispatched
- `quality_review`: spec review passed, quality reviewer dispatched
- `completed`: all review stages passed
- `failed`: max retries exceeded or unrecoverable error
- `blocked`: dependency failed or missing context

### Review Depth by Tier (Defaults)

| Tier                       | Default                      | Rationale                                               |
| -------------------------- | ---------------------------- | ------------------------------------------------------- |
| Kobold (scout)             | `none`                       | Mechanical work — file counts, searches, simple queries |
| Griffin (coder/researcher) | `single` (spec review)       | Implementation work needs correctness check             |
| Dragon (planner/reviewer)  | `two_stage` (spec + quality) | High-stakes work gets full scrutiny                     |

Overridable per-task at creation time. When `review_depth` is not explicitly set,
the daemon uses the tier-based default from this table. When `tier` is also unset,
the fallback is `two_stage` (the full superpowers model).

### Plan File Format

```markdown
---
id: 2026-04-12-ally-reliability
status: active
tags: [allies, reliability, cross-model]
created: 2026-04-12T10:00:00Z
---

# Improve Ally Reliability for Non-Anthropic Models

## Goal

Achieve >= 90% pass rate on all three parity fixtures across GLM model matrix.

## Tasks

- [[fix-progress-checkin]] — prompt tuning for voluntary progress reports
- [[add-stone-retry]] — retry stone_send on transient HTTP failures
- [[expand-parity-matrix]] — add glm-4.5-flash to fixture runs

## Success Criteria

- allies-parity harness: all fixtures pass >= 90% across model matrix
- No regression on Anthropic-model dispatch via CC

## Notes

Prior results in `allies-parity/results/2026-04-11T*.jsonl`.
Scout-question passes reliably. Scout-progress is the weak point.
```

### Index File (Auto-Generated)

The daemon regenerates `quests/index.md` on every task state change:

```markdown
# Quest Board

## Active Plans

- [[2026-04-12-ally-reliability]] — 1/3 completed, 1 in progress, 1 pending

## Tasks by Status

### In Progress

- [[fix-progress-checkin]] #griffin #stone — implementing (Dross assigned)

### Pending

- [[add-stone-retry]] #griffin #stone — blocked by [[fix-progress-checkin]]
- [[expand-parity-matrix]] #kobold #testing

### Completed

<!-- none yet -->

## Tags

#stone (2) · #reliability (3) · #glm (3) · #testing (1)
```

## Daemon MCP Tool Surface

### New Tools

| Tool           | Input                                                           | Output                  | Description                               |
| -------------- | --------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| `task_create`  | `{plan_id?, id, tier, review_depth?, tags?, blocked_by?, body}` | `{id, path}`            | Create a task file in the registry        |
| `task_update`  | `{id, status?, tags?, blocked_by?, body_append?}`               | `{id, status}`          | Update task frontmatter or append to body |
| `task_get`     | `{id}`                                                          | Full markdown content   | Read a task file                          |
| `task_list`    | `{status?, tag?, plan_id?, tier?}`                              | Summary array           | Query tasks with filters                  |
| `task_execute` | `{ids[], parallel?}`                                            | `{group_id}`            | Kick off implement→review loop for tasks  |
| `plan_create`  | `{id, body}`                                                    | `{id, path}`            | Write a plan document                     |
| `plan_status`  | `{id}`                                                          | Aggregate task statuses | Summary of plan progress                  |

### Modified Tools

| Tool             | Change                                                           |
| ---------------- | ---------------------------------------------------------------- |
| `quest_dispatch` | Unchanged — `task_execute` calls it internally                   |
| `quest_status`   | Add `task_id` field to response when quest is task-linked        |
| `quest_cancel`   | Cascade: cancelling a quest updates the linked task to `blocked` |

### Unchanged Tools

`stone_send`, `stone_receive`, `register_session`, `quest_cancel` — no changes needed.

## Orchestration Loop

When `task_execute` is called:

### Single Task

```
1. Read task file, validate status=pending, check blocked_by all completed
2. Update status → in_progress, then → implementing
3. Query graphify for related context:
   - Wikilinked nodes from task body
   - Tag-matched nodes from vault (similar problems, prior solutions)
   - Dead-end entries matching task tags/scope
4. Dispatch implementer ally via quest_dispatch(single)
   - Prompt includes: task body, acceptance criteria, graphify context
   - Ally reports via stone: progress (non-blocking), result (terminal)
5. On ally completion, read result from stone
6. If review_depth == none:
   - Update status → completed
   - Stone message to primary: "task completed"
7. If review_depth >= single:
   - Update status → spec_review
   - Write implementer output to reviews/{id}-implementation.md
   - Dispatch spec reviewer ally with: task file + implementation output
   - Reviewer reports: PASS / FAIL with notes
   - On FAIL: re-dispatch implementer with reviewer feedback (max 2 retries)
   - On PASS: proceed
8. If review_depth == two_stage:
   - Update status → quality_review
   - Dispatch quality reviewer with: task + implementation + spec review notes
   - Same PASS/FAIL/retry logic
9. On all reviews passed:
   - Update status → completed
   - Append review notes to task file body
   - Regenerate index.md
   - Stone message to primary: "task completed, reviews passed"
10. On max retries exceeded:
    - Update status → failed
    - Stone message to primary: "task failed after N retries, reviewer notes: ..."
```

### Multiple Tasks (parallel=true)

```
1. Partition tasks into dependency groups using blocked_by edges
   - If parallel=true but tasks have dependencies, the daemon respects them:
     independent tasks rally, dependent chains run sequentially within the group
   - If parallel=false (default), tasks execute in the order provided
2. Independent tasks → rally dispatch, each runs its own review loop
3. Dependent tasks → chain, outputs flow forward via {previous} substitution
4. Track group progress, update index.md as tasks complete
5. Stone message to primary on group completion with summary
```

### Ally Status Codes

Allies self-report one of four status codes in their final `stone_send(type="result")`:

| Code                 | Meaning                  | Daemon Action                                  |
| -------------------- | ------------------------ | ---------------------------------------------- |
| `DONE`               | Work complete, confident | Proceed to review                              |
| `DONE_WITH_CONCERNS` | Complete but uncertain   | Proceed to review, flag concerns to reviewer   |
| `NEEDS_CONTEXT`      | Missing information      | Update task → blocked, ask primary for context |
| `BLOCKED`            | Cannot proceed           | Update task → blocked, escalate to primary     |

## Graphify Integration

The daemon embeds graphify hooks directly:

### On Task State Change

When any task file is written or updated, the daemon:

1. Runs graphify rebuild on the `quests/` directory
2. Updates the graph index so wikilink queries reflect current state

### On Ally Dispatch (Context Enrichment)

Before dispatching an implementer or reviewer, the daemon:

1. Extracts tags and wikilinks from the task file
2. Queries the graphify graph for related nodes:
   - Same-tag nodes from `quests/` (sibling tasks, prior plans)
   - Same-tag nodes from configured vault paths (Obsidian research, other projects)
   - Dead-end entries matching task scope
3. Includes relevant hits (top N by relevance) in the ally's dispatch prompt
4. This gives allies cross-project awareness without the primary agent manually curating context

### Vault Configuration

The daemon accepts a list of vault paths in its config:

```json
{
  "graphify_vaults": [
    "quests/",
    "~/Documents/Obsidian/research/",
    "~/Development/quickshell/docs/"
  ]
}
```

Each path is indexed by graphify independently. Cross-vault wikilink resolution
follows Obsidian conventions (shortest unique match).

## What Changes Where

| Component            | Changes                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **storybook-daemon** | New `internal/task/` package: registry (parse/write md files with frontmatter), state machine, orchestration loop |
| **storybook-daemon** | New `internal/graphify/` package: rebuild trigger, context query interface                                        |
| **storybook-daemon** | `internal/psi/mcp/mcp.go`: register new task/plan MCP tool handlers                                               |
| **storybook-daemon** | `internal/quest/`: add `TaskID` field to Quest struct for linking                                                 |
| **berrygems**        | `hoard-allies/quest-tool.ts`: forward new task tools to daemon MCP                                                |
| **cc-plugin**        | Ally agent defs: add `task_*` tools to allowed-tools                                                              |
| **morsels/skills**   | `hoard:quest` SKILL.md: teach agents the task workflow                                                            |
| **quests/**          | New directory: plans/, tasks/, reviews/, index.md                                                                 |

## What This Doesn't Change

- **Quest dispatch mechanics** — `quest_dispatch`, `quest_status`, `quest_cancel` unchanged
- **Sending stone protocol** — message types unchanged; federation bridge is new infra (step 0) but doesn't alter the message schema
- **Ally taxonomy** — tiers, names, combos unchanged (tier determines review depth)
- **Parity harness** — `allies-parity/` unchanged, used to validate after changes

## Dependencies and Sequencing

0. **Stone federation bridge** — daemon broker ↔ pi HTTP stone bidirectional message routing.
   This is the foundation. Task orchestration, review dispatch, progress monitoring, and
   primary-agent intervention all flow through the stone. Build and validate this first so
   the task system's communication patterns are informed by what the stone actually supports.
1. **`internal/task/` registry** — parse/write markdown files, frontmatter handling. No external deps beyond (0) being stable.
2. **MCP tool handlers** — wire task_create/update/get/list/execute into the MCP server. Depends on (1).
3. **Orchestration loop** — implement→review state machine. Depends on (1), (0), and existing quest_dispatch.
4. **Graphify integration** — rebuild hooks and context queries. Can be built in parallel with (1-3).
5. **Berrygems/CC forwarding** — wire pi and CC to the new tools. Depends on (2).
6. **Skill updates** — update hoard:quest SKILL.md. Depends on (2) being stable.

## Open Questions

1. **Task file location**: `quests/` in project root, or a global location like `~/.hoard/quests/`?
   Project-local means task state is scoped to the repo. Global means cross-project plans.
   Recommendation: project-local by default, configurable to global.

2. **Review ally model tier**: Should spec reviewers run on the same tier as implementers,
   or always one tier up? Running griffin reviewers on griffin implementation means peer review;
   running dragon reviewers means senior review. Cost vs quality tradeoff.
   Recommendation: same tier by default, overridable per-task.

3. **Stone federation bridge**: The daemon broker and pi-side HTTP stone don't federate yet.
   The stone is the nervous system of the quest loop — task orchestration, review dispatch,
   progress monitoring, and primary-agent intervention all flow through it. Building the task
   system on an incomplete communication layer means hardening around gaps that get expensive
   to retrofit later.
   Recommendation: build the federation bridge FIRST, before task orchestration. The bridge
   work informs how the task system communicates, not the other way around. This moves stone
   federation from "What This Doesn't Change" into sequencing step 0.
