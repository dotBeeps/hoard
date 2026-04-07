---
name: hoard-kobolds
description: Dispatch subagents using the hoard kobold/griffin/dragon taxonomy. Use when planning subagent tasks, delegating work, or deciding which model tier to use for parallel/chained execution.
---

# Hoard Kobolds — Subagent Dispatch Strategy

## The Taxonomy

A 2D matrix: **adjective** (thinking level) × **noun** (model tier).

| Adjective | Thinking | Noun | Model | 
|-----------|----------|------|-------|
| silly/empty | none | kobold | haiku |
| clever | low | griffin | sonnet |
| wise | medium | dragon | opus |
| elder | high/xhigh | | |

Combined: `<adjective>-<noun>` → e.g. `wise-griffin` = sonnet + medium thinking.

## Available Agents

| Agent | Cost | Use Case |
|-------|------|----------|
| `silly-kobold` | $ | File discovery, listing, structure mapping, quick checks |
| `clever-kobold` | $ | Simple reviews, frontmatter validation, config checks |
| `wise-kobold` | $$ | Pattern matching, comparisons, moderate code review |
| `silly-griffin` | $$ | Code generation, straightforward implementation |
| `clever-griffin` | $$$ | Reviews, debugging, feature implementation |
| `wise-griffin` | $$$ | Architecture review, spec alignment, deep analysis |
| `elder-griffin` | $$$$ | Complex refactoring, security review, deep debugging |
| `elder-dragon` | $$$$$ | Foundational decisions, ethics review, major spec work |

## The Rule

> **Default to kobold. Escalate only when the task genuinely needs more.**

Token budget is finite. This is an ethical obligation per ETHICS.md §3.7 (carbon accountability). Wasting tokens on an elder-griffin when a clever-kobold would suffice is wasteful.

## Decision Tree

```
Does the task need to WRITE code or GENERATE content?
  ├─ No → Does it need reasoning?
  │        ├─ No → silly-kobold (just fetch/scan)
  │        ├─ Light → clever-kobold (validate, compare)
  │        └─ Medium → wise-kobold (review, analyze)
  └─ Yes → How complex?
           ├─ Simple/templated → silly-griffin
           ├─ Moderate → clever-griffin
           ├─ Complex with deep analysis → wise-griffin or elder-griffin
           └─ Project-shaping → elder-dragon (justify this!)
```

## Dispatch Patterns

### Parallel Scouts (cheap, fast)
```json
{"tasks": [
  {"agent": "silly-kobold", "task": "List all .go files in dragon-daemon/internal/"},
  {"agent": "silly-kobold", "task": "List all .ts files in berrygems/extensions/"},
  {"agent": "silly-kobold", "task": "List all SKILL.md files with line counts"}
]}
```

### Scout → Review Chain (escalating)
```json
{"chain": [
  {"agent": "silly-kobold", "task": "Find all files related to {task}"},
  {"agent": "wise-kobold", "task": "Review the files found: {previous}"}
]}
```

### Targeted Deep Review (justified escalation)
```json
{"tasks": [
  {"agent": "wise-griffin", "task": "Review ethics compliance of consent/ package"},
  {"agent": "clever-kobold", "task": "Check frontmatter in all SKILL.md files"}
]}
```

## Guidelines

- **Max parallel agents:** 3–5 (avoid rate limits, avoid budget blowout)
- **Prefer more kobolds over fewer griffins** — three kobolds scanning different dirs costs less than one griffin scanning all three
- **Chain when possible** — kobold scouts first, then escalate only the findings that need deeper review
- **Dragon dispatch requires justification** — if you're sending an elder-dragon, say why
- **Match the model to the task** — code generation needs capability (griffin+), analysis needs thinking (wise+), scanning needs neither (silly-kobold)

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
- You're already in a subagent (avoid inception unless necessary)

## Escalation Patterns

### Two-Phase: Scout then Review
Send kobolds to scan, then escalate findings to a griffin:
```json
{"chain": [
  {"agent": "silly-kobold", "task": "List all files and summarize structure of {task}"},
  {"agent": "wise-kobold", "task": "Review the findings and flag issues: {previous}"}
]}
```

### Parallel Scan with Single Synthesis
Kobolds scan in parallel, you synthesize their findings yourself:
```json
{"tasks": [
  {"agent": "silly-kobold", "task": "Scan dragon-daemon/internal/soul/ and summarize"},
  {"agent": "silly-kobold", "task": "Scan dragon-daemon/internal/consent/ and summarize"},
  {"agent": "silly-kobold", "task": "Scan dragon-daemon/internal/memory/ and summarize"}
]}
```
Then review and synthesize their output yourself (you're already in context).

### Targeted Expert Review
When you know exactly what needs deep analysis:
```json
{"tasks": [
  {"agent": "wise-griffin", "task": "Review ethics compliance of the consent package"},
  {"agent": "clever-kobold", "task": "Validate all SKILL.md frontmatter"}
]}
```
