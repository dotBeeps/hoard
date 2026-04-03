# AGENTS.md

## Project Overview

**Hoard** — a monorepo of agent tools for [pi](https://github.com/badlogic/pi-mono). Three components:

- **berrygems/** — Pi extensions (TypeScript). Interactive tools, floating panels, permission guards, tone management.
- **morsels/** — Pi skills (Markdown). On-demand knowledge packages for git, GitHub, writing, pi internals.
- **dragon-daemon/** — Go daemon. Memory consolidation, vault maintenance, async operations that outlive sessions.

Installable via `pi install https://github.com/dotBeeps/hoard`. Pi auto-discovers `extensions/` and `skills/` in each sub-package.

## Repository Structure

```
hoard/
├── berrygems/                 Pi extensions (TypeScript)
│   ├── extensions/
│   │   ├── ask.ts                 Interactive user input (select/confirm/text)
│   │   ├── dots-panels.ts        Central panel authority — creation, positioning, focus
│   │   ├── digestion-settings.ts  Compaction tuning panel
│   │   ├── popup.ts              Markdown popup panels (scrollable, updatable by ID)
│   │   ├── todo-lists.ts         Floating todo panels with GIF mascots
│   │   ├── dragon-guard/         Three-tier permission guard
│   │   └── lint-panel.ts         Floating diagnostics panel (tsc type errors)
│   ├── lib/
│   │   ├── settings.ts            Shared settings reader (hoard.* + legacy fallback)
│   │   ├── panel-chrome.ts        Shared border/focus/header/footer rendering + 19 panel skins
│   │   └── lsp-client.ts          Minimal LSP client (JSON-RPC over stdio)
│   ├── styles/                    Writing tone files (formal, friendly, etc.)
│   ├── tsconfig.json              Type checking config (resolves pi packages via symlinks)
│   └── package.json
├── morsels/                   Pi skills (Markdown)
│   ├── skills/
│   │   ├── git/                   Git operations + rebase/bisect references
│   │   ├── commit/                Conventional Commits + AI attribution
│   │   ├── git-auth/              SSH + rbw credential management
│   │   ├── github/                gh CLI operations + GraphQL patterns
│   │   ├── github-writing/        Interview-driven document authoring
│   │   ├── github-markdown/       GFM conventions
│   │   ├── extension-designer/    Build pi extensions
│   │   ├── skill-designer/        Build agent skills
│   │   ├── dot-panels/            Build panel extensions
│   │   ├── dots-todos/            Task tracking with panels
│   │   ├── pi-events/             Event hooks reference
│   │   ├── pi-sessions/           Sessions & state management
│   │   ├── pi-tui/                TUI component building
│   │   ├── agent-init/            Generate AGENTS.md files
│   │   ├── typescript-check/      Run tsc/eslint, interpret errors, fix patterns
│   │   └── go-check/              Run go vet/golangci-lint/go test, interpret output
│   └── package.json
├── den/                       Internal docs (not shipped)
│   ├── plans/                     Specs, roadmaps
│   ├── research/                  Design reviews, explorations
│   └── moments/                   Test session logs, interaction captures
├── dragon-daemon/             Go daemon (planned)
│   ├── main.go
│   └── go.mod
├── package.json               Root manifest (references sub-packages)
├── AGENTS.md
└── README.md
```

## Setup & Development

```bash
# Install as a pi package (both berrygems + morsels)
pi install https://github.com/dotBeeps/hoard

# Or for local development
pi install /path/to/hoard

# Build the daemon (when implemented)
cd dragon-daemon && go build -o dragon-daemon .
```

- **No build step for berrygems** — pi loads `.ts` files directly via jiti
- **No build step for morsels** — pi loads Markdown skills directly
- **Reload after changes** — run `/reload` in pi to pick up extension edits
- **Settings file** — `~/.pi/agent/settings.json` (global), `.pi/settings.json` (project)

## Verification

Run these checks before committing changes. Each subrepo has its own toolchain.

### berrygems (TypeScript)

```bash
# Type check — catches type errors, bad imports, missing properties
cd /home/dot/Development/hoard && tsc --project berrygems/tsconfig.json

# Quick single-file check (useful during development)
tsc --project berrygems/tsconfig.json 2>&1 | grep "<filename>"
```

- tsconfig resolves `@mariozechner/pi-*` via symlinks in `node_modules/`
- Symlinks point to pi's installed packages at `~/.npm/lib/node_modules/mitsupi/node_modules/`
- If symlinks break after pi updates, recreate them:
  ```bash
  PI_MODULES="$HOME/.npm/lib/node_modules/mitsupi/node_modules"
  mkdir -p node_modules/@mariozechner
  ln -sf "$PI_MODULES/@mariozechner/pi-tui" node_modules/@mariozechner/pi-tui
  ln -sf "$PI_MODULES/@mariozechner/pi-coding-agent" node_modules/@mariozechner/pi-coding-agent
  ln -sf "$PI_MODULES/@mariozechner/pi-ai" node_modules/@mariozechner/pi-ai
  ln -sf "$PI_MODULES/@mariozechner/pi-agent-core" node_modules/@mariozechner/pi-agent-core
  ln -sf "$PI_MODULES/@sinclair" node_modules/@sinclair
  ```
- No eslint config yet — type checking is the primary gate
- No test framework yet — manual testing via `/reload` in pi

### dragon-daemon (Go)

```bash
# Vet — catches suspicious constructs
cd dragon-daemon && go vet ./...

# Lint — comprehensive static analysis
cd dragon-daemon && golangci-lint run ./...

# Build — verify compilation
cd dragon-daemon && go build -o dragon-daemon .
```

### morsels (Markdown)

- No automated linting — review skill frontmatter manually
- Required frontmatter fields: `name` (must match directory), `description`
- Keep SKILL.md under 500 lines; move reference material to `references/`

### Pre-Commit Checklist

1. `tsc --project berrygems/tsconfig.json` — zero errors
2. `cd dragon-daemon && go vet ./... && golangci-lint run ./...` — zero issues
3. Test extension changes with `/reload` in pi
4. Skill frontmatter valid (`name` matches directory, `description` present)

## Pi Platform

This project extends [pi](https://github.com/badlogic/pi-mono), a terminal coding agent harness.

### Monorepo Packages

| Package | Role | You Import |
|---|---|---|
| `@mariozechner/pi-ai` | LLM API, model discovery, streaming | `StringEnum` |
| `@mariozechner/pi-tui` | Terminal UI components, keyboard, rendering | `Text`, `Box`, `Container`, `SelectList`, `SettingsList`, `matchesKey`, `Key`, `truncateToWidth`, `visibleWidth` |
| `@mariozechner/pi-agent-core` | Agent loop, state, transport abstraction | (rarely imported directly) |
| `@mariozechner/pi-coding-agent` | Coding agent CLI — tools, sessions, extensions, skills, compaction | `ExtensionAPI`, `ExtensionContext`, `DynamicBorder`, `BorderedLoader`, `getMarkdownTheme`, `keyHint`, `isToolCallEventType`, `withFileMutationQueue`, `CustomEditor` |
| `@sinclair/typebox` | JSON schema definitions | `Type` for tool parameter schemas |

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
// Publisher (dots-panels.ts)
const API_KEY = Symbol.for("dot.panels");
(globalThis as any)[API_KEY] = { register, close, focusPanel, ... };

// Consumer (any extension in berrygems)
const panels = (globalThis as any)[Symbol.for("dot.panels")];
panels?.register("my-panel", { handle, invalidate, dispose });
```

### Settings Namespace

All settings under `hoard` in `~/.pi/agent/settings.json`, with tiered nesting. Legacy `dotsPiEnhancements` flat keys are still read as fallback via `berrygems/lib/settings.ts`.

```
hoard.guard.*        Dragon Guard (autoDetect, dogAllowedTools, keys)
hoard.panels.*       Panel system (focusKey, closeKey, unfocusKey)
hoard.digestion.*    Compaction tuning (triggerMode, strategy)
hoard.todos.*        Todo panels (gifVibePrompt, gifRating)
hoard.contributor.*  AI attribution (name, email, trailerFormat)
hoard.tone.*         Writing style (default, overrides)
```

### AI Contributor Identity

```json
{
  "hoard": {
    "contributor": {
      "name": "Ember 🐉",
      "email": "ember-ai@dotbeeps.dev",
      "trailerFormat": "Co-authored-by: Ember 🐉 <ember-ai@dotbeeps.dev>",
      "transparencyFormat": "Authored with Ember 🐉 [{model}]",
      "includeModel": true
    }
  }
}
```

Skills reference this for `Co-authored-by` trailers and transparency notes. If absent, skip AI attribution.

### Writing Tones

```json
{
  "hoard": {
    "tone": {
      "default": "personality",
      "overrides": {
        "security": "formal",
        "coc": "formal"
      }
    }
  }
}
```

Tone files in `berrygems/styles/`. Controls document writing voice only — does not affect agent personality.

## Code Style

- **TypeScript** — tabs for indentation, double quotes, semicolons; `satisfies` over `as`; no `any` without comment
- **Go** — standard `gofmt`, no special conventions beyond golangci-lint defaults
- **Markdown** — ATX headings (`#`), bullet lists with `-`, fenced code blocks with language tags
- **Skill frontmatter** — YAML between `---` fences, `name` and `description` required

## Commits

Conventional Commits: `<type>(<scope>): <summary>`

- `feat` for new skills or extensions
- `fix` for bug fixes
- `docs` for README or skill content updates
- `refactor` for restructuring without behavior change
- Scope is the skill, extension, or component name
- Summary ≤72 chars, imperative mood, no trailing period
