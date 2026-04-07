---
name: hoard-allies
description: Dispatch subagents using the hoard kobold/griffin/dragon taxonomy. Use when planning subagent tasks, delegating work, or deciding which model tier to use for parallel/chained execution.
---

# Hoard Allies — Subagent Dispatch Strategy

## The Taxonomy

A 3D matrix: **adjective** (thinking) × **noun** (model) × **job** (role).

| Adjective | Thinking | Noun | Model | Job | Role |
|-----------|----------|------|-------|-----|------|
| silly | none | kobold | haiku | scout | File scanning, recon |
| clever | low | griffin | sonnet | reviewer | Analysis, validation |
| wise | medium | dragon | opus | coder | Implementation |
| elder | high | | | researcher | Gathering, synthesis |
| | | | | planner | Strategy, specs |

Combined: `<adjective>-<noun>-<job>` → e.g. `wise-griffin-reviewer` = sonnet + medium thinking + code review role.

## Budget System

Allies are **budget-gated, not count-gated**. Each combo has a cost calculated as:

```
cost = noun_weight × thinking_multiplier × job_multiplier
```

| Factor | Values |
|--------|--------|
| Noun | kobold=1, griffin=5, dragon=25 |
| Thinking | silly=1, clever=1.5, wise=2, elder=3 |
| Job | scout=0.5, reviewer=1, coder=1.5, researcher=1, planner=1.2 |

Primary session budget: **100 pts** (configurable). Refund: 50% on completion, 100% on failure.

A silly-kobold-scout costs **0.5 pts** — you can dispatch 200 of them. An elder-dragon-planner costs **90 pts** — that's nearly your entire budget. This reflects real resource consumption per ETHICS.md §3.7.

## Available Agents (13 curated combos)

| Agent | Formula | Cost | Use Case |
|-------|---------|------|----------|
| `silly-kobold-scout` | 1 × 1 × 0.5 | 0.5 | File discovery, listing, structure mapping |
| `clever-kobold-scout` | 1 × 1.5 × 0.5 | 0.75 | Scanning with light reasoning |
| `clever-kobold-reviewer` | 1 × 1.5 × 1 | 1.5 | Simple validation, frontmatter checks |
| `wise-kobold-reviewer` | 1 × 2 × 1 | 2.0 | Pattern matching, moderate code review |
| `silly-griffin-coder` | 5 × 1 × 1.5 | 7.5 | Straightforward code generation |
| `clever-griffin-coder` | 5 × 1.5 × 1.5 | 11.25 | Feature implementation, refactoring |
| `clever-griffin-reviewer` | 5 × 1.5 × 1 | 7.5 | Thorough code review, architecture analysis |
| `wise-griffin-reviewer` | 5 × 2 × 1 | 10.0 | Deep review, spec alignment |
| `wise-griffin-researcher` | 5 × 2 × 1 | 10.0 | Research, synthesis, multi-source comparison |
| `elder-griffin-coder` | 5 × 3 × 1.5 | 22.5 | Complex refactoring, multi-file changes |
| `elder-griffin-reviewer` | 5 × 3 × 1 | 15.0 | Security review, ethics compliance |
| `wise-dragon-planner` | 25 × 2 × 1.2 | 60.0 | Major spec authoring, architecture decisions |
| `elder-dragon-planner` | 25 × 3 × 1.2 | 90.0 | Foundational decisions — justify this! |

## The Rule

> **Default to kobold. Escalate only when the task genuinely needs more.**

Budget is finite. This is an ethical obligation per ETHICS.md §3.7 (carbon accountability).

## Decision Tree

```
What role does this subtask need?
├─ Recon/scanning → scout
├─ Analysis/validation → reviewer
├─ Write/edit code → coder
├─ Gather/synthesize info → researcher
└─ Plan/spec/strategy → planner

What model tier?
├─ Can a kobold handle it? → kobold (try this first!)
├─ Needs capability → griffin
└─ Critical/foundational → dragon (justify!)

How much reasoning?
├─ Mechanical → silly (no thinking)
├─ Light analysis → clever (low thinking)
├─ Deep analysis → wise (medium thinking)
└─ Critical decisions → elder (high thinking)
```

## Dispatch Patterns

### Parallel Scouts (cheap, fast)
```json
{"tasks": [
  {"agent": "silly-kobold-scout", "task": "List all .go files in dragon-daemon/internal/"},
  {"agent": "silly-kobold-scout", "task": "List all .ts files in berrygems/extensions/"},
  {"agent": "silly-kobold-scout", "task": "List all SKILL.md files with line counts"}
]}
```
**Cost: 1.5 pts** for all three scouts.

### Scout → Review Chain (escalating)
```json
{"chain": [
  {"agent": "silly-kobold-scout", "task": "Find all files related to {task}"},
  {"agent": "clever-kobold-reviewer", "task": "Review the files found: {previous}"}
]}
```
**Cost: 2.0 pts** for both steps.

### Parallel Review (different dimensions)
```json
{"tasks": [
  {"agent": "clever-kobold-reviewer", "task": "Check frontmatter in all SKILL.md files"},
  {"agent": "clever-griffin-reviewer", "task": "Review ethics compliance of consent/ package"}
]}
```
**Cost: 9.0 pts** — kobold handles the mechanical check, griffin handles the judgment call.

### Implementation with Scouting
```json
{"chain": [
  {"agent": "clever-kobold-scout", "task": "Find all usages of old API pattern"},
  {"agent": "clever-griffin-coder", "task": "Migrate the found usages: {previous}"}
]}
```
**Cost: 12.0 pts** — scout cheaply, then coder acts on findings.

## Guidelines

- **Max parallel agents:** configurable (default 4). Avoid rate limits.
- **Prefer more kobolds over fewer griffins** — three kobold scouts (1.5 pts) cost less than one griffin reviewer (7.5 pts)
- **Chain when possible** — scouts first, then escalate only findings that need it
- **Match job to role** — don't use a coder for analysis, don't use a scout for implementation
- **Dragon dispatch requires justification** — if you're sending a dragon, say why

## When to Dispatch vs Do It Yourself

**Dispatch when:**
- A task has 3+ independent subtasks that can run simultaneously
- You'd otherwise read 5+ files sequentially before synthesizing
- You need to check multiple quality dimensions in parallel
- The task involves scanning a large codebase for patterns

**Don't dispatch when:**
- The task is simple enough to handle in a few tool calls
- Subtasks depend on each other's output (use chains if needed)
- You'd be sending 1 agent to do 1 small thing
- You're already in a subagent (check your spawn budget)

## Named Allies

Each dispatched ally gets a name from a shuffled pool:
- **Kobolds:** Grix, Snark, Blik, Twig, Pip, Fizz, etc. (30 names)
- **Griffins:** Aldric, Kestrel, Talon, Sable, Argent, etc. (28 names)
- **Dragons:** Azurath, Thalaxis, Pyranthis, Veridian, etc. (14 names)

Names make dispatch announcements more readable and tracking easier.
