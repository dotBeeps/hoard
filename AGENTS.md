# AGENTS.md

## Ethical Grounding

**All work on this project is grounded in [ETHICS.md](ETHICS.md).** Read it before contributing.

ETHICS.md is the project's ethical foundation — not advisory. It informs how user data is handled, how consent is surfaced, and how observation is framed in any tool the pantry ships.

## Project Overview

**Pantry** is a pi-package — a monorepo of extensions and skills for [pi](https://github.com/badlogic/pi-mono), installable as a single unit.

- **berrygems/** — pi extensions (TypeScript). Programmatic, deterministic tools loaded by pi at session start. Panels, guards, diagnostics, carbon tracking, image rendering, compaction, todos, code review.
- **morsels/** — agent skills (Markdown). Harness-agnostic, grab-and-go knowledge any agent can consume. Some morsels document specific berrygem APIs; most are general-purpose.
- **den/** — internal planning workspace (not shipped with the package).

Installable via `pi install https://github.com/dotBeeps/pantry`. Pi auto-discovers `berrygems/extensions/` and `morsels/skills/` per the root `package.json`:

```json
"pi": {
  "extensions": ["berrygems/extensions"],
  "skills": ["morsels/skills"]
}
```

## Feature Lifecycle

Features move through six states, tracked with emoji in inventory tables:

| emoji | state       | definition                                                                            |
| ----- | ----------- | ------------------------------------------------------------------------------------- |
| 💭    | idea        | Name and up to 500 words of description. No research or code yet.                     |
| 📜    | researched  | Research documents and/or relevant source files present.                              |
| 🥚    | planned     | Work broken down into phases. No code written. Spec lives in `den/features/{name}/`.  |
| 🐣    | in-progress | Code work cycle started. Current state documented in `den/features/{name}/AGENTS.md`. |
| 🔥    | beta        | Usable and being manually tested. Manually designated.                                |
| 💎    | complete    | Manually marked done when stable and well-tested.                                     |

## Repository Layout

```
pantry/
├── berrygems/        Pi extensions (TypeScript)
│   ├── extensions/   Extension files and directories
│   ├── lib/          Shared utilities
│   ├── styles/       Writing tone files (formal, friendly, etc.)
│   ├── tsconfig.json Type checking config (resolves pi packages via symlinks)
│   ├── AGENTS.md     Extension-layer conventions
│   └── package.json
├── morsels/          Pi skills (Markdown)
│   ├── skills/       One directory per skill, each with SKILL.md
│   ├── AGENTS.md     Skill-layer conventions
│   └── package.json
├── den/              Planning workspace (not shipped)
│   └── features/     Per-feature docs — plans, research, reviews, current state
├── .claude/          Claude Code config (rules, settings)
├── .planning/        GSD planning state
├── ETHICS.md         Ethical grounding — read before consent/privacy/memory work
├── CLAUDE.md         Claude Code-specific additions
├── README.md
├── package.json      Root manifest (pi.extensions + pi.skills)
└── AGENTS.md         ← you are here
```

## Setup & Development

```fish
# Install as a pi package (both berrygems + morsels)
pi install https://github.com/dotBeeps/pantry

# Or for local development
pi install /path/to/pantry
```

- **No build step for berrygems** — pi loads `.ts` files directly via jiti.
- **No build step for morsels** — pi loads Markdown skills directly.
- **Reload after changes** — run `/reload` in pi to pick up extension edits.
- **Settings file** — `~/.pi/agent/settings.json` (global), `.pi/settings.json` (project).

## Verification

There is one automated gate: `tsc` over the berrygems source. Everything else is manual review and `/reload` testing. Be honest about this — no Vitest, no eslint, no skill linter is wired up yet.

### berrygems (TypeScript)

```fish
# Type check — catches type errors, bad imports, missing properties
cd /home/dot/Development/pantry; and tsc --project berrygems/tsconfig.json
```

- `tsconfig.json` resolves `@mariozechner/pi-*` via local `node_modules` symlinks.
- Symlinks point to pi's installed packages under `~/.npm/lib/node_modules/@mariozechner/pi-coding-agent/node_modules/`.
- If symlinks break after pi updates, recreate them:
  ```fish
  set PI_MODULES "$HOME/.npm/lib/node_modules/@mariozechner/pi-coding-agent/node_modules"
  mkdir -p node_modules/@mariozechner berrygems/node_modules/@mariozechner
  for MODULE_ROOT in node_modules berrygems/node_modules
      ln -sf "$HOME/.npm/lib/node_modules/@mariozechner/pi-coding-agent" "$MODULE_ROOT/@mariozechner/pi-coding-agent"
      ln -sf "$PI_MODULES/@mariozechner/pi-tui" "$MODULE_ROOT/@mariozechner/pi-tui"
      ln -sf "$PI_MODULES/@mariozechner/pi-ai" "$MODULE_ROOT/@mariozechner/pi-ai"
      ln -sf "$PI_MODULES/@mariozechner/pi-agent-core" "$MODULE_ROOT/@mariozechner/pi-agent-core"
      ln -sf "$PI_MODULES/typebox" "$MODULE_ROOT/typebox"
  end
  ```
- No eslint config. No test framework. Type checking is the only automated gate; behaviour testing is manual via `/reload` in pi.

### morsels (Markdown)

- No automated linting — review skill frontmatter manually.
- Required frontmatter fields: `name` (must match directory), `description`, `license: MIT`.
- Pi-specific skills include `compatibility: "Designed for Pi (pi-coding-agent)"`.
- Skills with env requirements include a `compatibility` note (see `defuddle`, `git-auth`).
- Keep `SKILL.md` under 500 lines; move reference material to `references/`.

### Pre-Commit Checklist

1. `tsc --project berrygems/tsconfig.json` — zero errors.
2. Test extension changes with `/reload` in pi.
3. Skill frontmatter valid: `name` matches directory, `description` + `license: MIT` present; pi-specific skills have `compatibility` set.

## Pi Platform

This project extends [pi](https://github.com/badlogic/pi-mono), a terminal coding agent harness.

### Monorepo Packages

| Package                         | Role                                                               | You Import                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mariozechner/pi-ai`           | LLM API, model discovery, streaming                                | `StringEnum`                                                                                                                                                         |
| `@mariozechner/pi-tui`          | Terminal UI components, keyboard, rendering                        | `Text`, `Box`, `Container`, `SelectList`, `SettingsList`, `matchesKey`, `Key`, `truncateToWidth`, `visibleWidth`                                                     |
| `@mariozechner/pi-agent-core`   | Agent loop, state, transport abstraction                           | (rarely imported directly)                                                                                                                                           |
| `@mariozechner/pi-coding-agent` | Coding agent CLI — tools, sessions, extensions, skills, compaction | `ExtensionAPI`, `ExtensionContext`, `DynamicBorder`, `BorderedLoader`, `getMarkdownTheme`, `keyHint`, `isToolCallEventType`, `withFileMutationQueue`, `CustomEditor` |
| `typebox`                      | JSON schema definitions                                            | `Type` for tool parameter schemas                                                                                                                                    |

### Extension Runtime

Extensions loaded via jiti — TypeScript runs without compilation. Each extension gets its own module context (**modules are isolated between extensions**). Use `globalThis` + `Symbol.for()` for cross-extension communication, never direct imports.

Hot-reload with `/reload`.

### Event Lifecycle

```
session_start → user types → input (can intercept/transform)
  → before_agent_start (inject message, modify system prompt)
  → agent_start
    → turn_start → context (modify messages) → before_provider_request
      → tool_call (can BLOCK or MUTATE args)
      → tool_result (can MODIFY result)
    → turn_end
  → agent_end
```

### Sessions & State

Sessions are JSONL tree structures. **Store state in tool result `details` or `pi.appendEntry()`, never in external files** (breaks branching). Reconstruct from `ctx.sessionManager.getBranch()` on session events.

Exception: the memory vault (`.pi/memory/`, `~/.pi/agent/memory/`) is intentionally external — it's cross-session by design.

### Compaction

Auto-triggers when `tokens > contextWindow - reserveTokens`. `reserveTokens` serves double duty: trigger threshold AND output budget cap for the compaction LLM call.

## Architecture

### Inter-Extension Communication

```typescript
// Publisher (dragon-parchment.ts)
const API_KEY = Symbol.for("pantry.parchment");
(globalThis as any)[API_KEY] = { register, close, focusPanel /* ... */ };

// Consumer (any extension in berrygems)
const panels = (globalThis as any)[Symbol.for("pantry.parchment")];
panels?.register("my-panel", { handle, invalidate, dispose });
```

### Settings Namespace

All settings under `pantry.*` in `~/.pi/agent/settings.json`, with tiered nesting. Access via `readPantrySetting()` from `berrygems/lib/settings.ts` — never hand-parse JSON. Legacy `dotsPiEnhancements` flat keys are still read as fallback.

For per-namespace keys, `grep berrygems -r readPantrySetting` or read the extension's own file.

### AI Contributor Identity

```json
{
  "pantry": {
    "contributor": {
      "name": "<persona name>",
      "email": "<contact email>",
      "trailerFormat": "Co-authored-by: <name> <<email>>",
      "transparencyFormat": "Authored with <name> [{model}]",
      "includeModel": true
    }
  }
}
```

Skills reference this for `Co-authored-by` trailers and transparency notes. If absent, skip AI attribution.

### Writing Tones

```json
{
  "pantry": {
    "tone": {
      "default": "personality",
      "overrides": { "security": "formal", "coc": "formal" }
    }
  }
}
```

Tone files live in `berrygems/styles/`. Controls document writing voice only — does not affect agent personality.

## Code Style

Formatters and linters are the ground truth — `prettier`/`tsc` for TypeScript. The rules below are what tooling can't catch.

- **TypeScript** — `satisfies` over `as`; no `any` without an explanatory comment.
- **Skill frontmatter** — YAML between `---` fences; `name` and `description` required.
- **Scripting** — fish, not bash. Snippets in this repo's docs use fish syntax.

### berrygems Conventions

**Shared library first.** Before writing any utility, `grep berrygems/lib/` for existing solutions. Extract to `berrygems/lib/` on second use — never duplicate with a justifying comment.

- `readPantrySetting()` from `lib/settings.ts` for ALL settings access — never hand-roll JSON parsing.
- `generateShortId()` / `generateId()` from `lib/id.ts` — never `Math.random().toString(36)`.

Available libs: `settings`, `ally-taxonomy`, `pi-spawn`, `id`, `cooldown`, `local-server`, `sse-client`, `panel-chrome`, `compaction-templates`, `animated-image`, `animated-image-player`, `giphy-source`, `lsp-client`.

**Structural rules:**

- One tool registration per file. 300+ lines in an extension file = split candidate.
- `> 4` function parameters → options object. No exceptions.
- Skills and code co-ship. Adding behavior without updating the skill is incomplete work.
- Cross-extension communication via `globalThis` + `Symbol.for()` — never direct imports between extensions.
- Single-file extensions graduate to directories when they reach `in-progress`; at that point they gain a code-side `AGENTS.md` documenting patterns, antipatterns, and inter-extension interactions.
- Every `pi.registerTool()` call includes `promptSnippet` and `promptGuidelines` — without them, pi omits the tool from the system prompt's context blocks. See `berrygems/AGENTS.md` for the full template.

### morsels Conventions

Skills are Markdown files, one directory per skill under `morsels/skills/`, each with a `SKILL.md`.

- `name` is lowercase-hyphenated and must match the directory name.
- `description` covers _what_ the skill does AND _when_ to use it; include trigger keywords; max 1024 chars.
- `license: MIT` is always set for pantry morsels.
- `compatibility` is optional; add when the skill is pi-specific or requires external tooling.
- Keep `SKILL.md` under 500 lines — move reference material to a `references/` subdirectory.

See `morsels/AGENTS.md` for the full frontmatter spec and examples.

## Commits

Conventional Commits: `<type>(<scope>): <summary>`

- `feat` for new skills or extensions.
- `fix` for bug fixes.
- `docs` for README or skill content updates.
- `refactor` for restructuring without behavior change.
- Scope is the skill, extension, or lib module name.
- Summary ≤72 chars, imperative mood, no trailing period.
