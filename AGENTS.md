# AGENTS.md

## Project Overview

**Hoard** — a monorepo of agent tools for [pi](https://github.com/badlogic/pi-mono). Three components:

- **berrygems/** — Pi extensions (TypeScript). Interactive tools, floating panels, permission guards, tone management.
- **morsels/** — Pi skills (Markdown). On-demand knowledge packages for git, GitHub, writing, pi internals.
- **dragon-daemon/** — Go daemon. Memory consolidation, vault maintenance, async operations that outlive sessions.

Installable via `pi install https://github.com/dotBeeps/hoard`. Pi auto-discovers `extensions/` and `skills/` in each sub-package.

## Feature Lifecycle

Features move through six states, tracked with emoji in all inventory tables:

| emoji | state | definition |
|---|---|---|
| 💭 | idea | Name and up to 500 words of description. No research or code yet. |
| 📜 | researched | Research documents and/or relevant source files present. *(Auto-update via GitHub Actions is planned — see [Hoard Infrastructure](#hoard-infrastructure))* |
| 🥚 | planned | Work broken down into phases. No code written. Spec lives in `den/features/{name}/`. |
| 🐣 | in-progress | Code work cycle started. Current state documented in `den/features/{name}/AGENTS.md`. |
| 🔥 | beta | Usable and being manually tested. Manually designated. |
| 💎 | complete | Manually marked done when stable and well-tested. |

## Hoard Features

### berrygems — Extensions

Extensions are TypeScript files loaded by pi via jiti. Multi-file extensions use a directory with `index.ts` as entry point (e.g. `dragon-guard/`). Single-file extensions will graduate to directories when they reach `in-progress` state, at which point they also gain a code-side `AGENTS.md` documenting patterns, antipatterns, and inter-extension interactions.

| | extension | description |
|---|---|---|
| 🔥 | dragon-breath | Carbon/energy tracking footer widget + `/carbon` command |
| 💎 | dragon-curfew | Bedtime enforcement — blocks tool calls during curfew hours |
| 🔥 | dragon-digestion | Tiered compaction system with progressive context management |
| 🔥 | dragon-guard/ | Three-tier permission guard |
| 💎 | dragon-herald | Desktop notifications on agent completion (OSC777 + notify-send) |
| 🔥 | dragon-image-fetch | Multi-source image/GIF fetch API (Giphy/Tenor/URL/file) |
| 💎 | dragon-inquiry | Interactive user input (select/confirm/text) |
| 🥚 | dragon-lab | Auth-aware provider beta header manager *(blocks `anthropicContextEdits` in dragon-digestion)* |
| 🐣 | dragon-loop | Automation loops with breakout conditions + `/loop` command |
| 🔥 | dragon-musings | LLM-generated contextual thinking spinner |
| 🔥 | dragon-parchment | Central panel authority — creation, positioning, focus |
| 🔥 | dragon-review | Code review via `/review` and `/end-review` commands |
| 🔥 | dragon-scroll | Markdown popup panels (scrollable, updatable by ID) |
| 💎 | dragon-tongue | Floating diagnostics panel (tsc type errors) |
| 🔥 | kitty-gif-renderer | Kitty Graphics Protocol image rendering for panels |
| 🔥 | kobold-housekeeping | Floating todo panels with GIF mascots |

### berrygems — Library

Shared utilities used across extensions. Not loaded directly by pi.

| | module | description |
|---|---|---|
| 🔥 | animated-image-player | Playback lifecycle controller for AnimatedImage |
| 🔥 | animated-image | Kitty Graphics Protocol frame rendering |
| 🔥 | compaction-templates | Structured summary templates + strategy presets |
| 🔥 | giphy-source | Giphy API fetch + GIF frame extraction |
| 🔥 | lsp-client | Minimal LSP client (JSON-RPC over stdio) |
| 🔥 | panel-chrome | Shared border/focus/header/footer rendering + 19 panel skins |
| 🔥 | settings | Shared settings reader (`hoard.*` + legacy fallback) |

### morsels — Skills

| | skill | description |
|---|---|---|
| 🔥 | agent-init | Generate AGENTS.md files |
| 💎 | api-design | REST/GraphQL/OpenAPI design patterns |
| 💎 | commit | Conventional Commits + AI attribution |
| 💎 | database | Schema design, migrations, ORMs, query optimization |
| 💎 | defuddle | Extract clean markdown from web pages via Defuddle CLI |
| 💎 | dependency-management | Cross-ecosystem dependency management (bun/uv/cargo/Go/Gradle) |
| 💎 | docker | Dockerfiles, multi-stage builds, Compose, security |
| 🔥 | dragon-image-fetch | Use the dragon-image-fetch extension API |
| 🔥 | dragon-parchment | Build panel extensions |
| 🔥 | extension-designer | Build pi extensions |
| 💎 | git | Git operations + rebase/bisect references |
| 💎 | git-auth | SSH + rbw credential management |
| 💎 | github | gh CLI operations + GraphQL patterns |
| 💎 | github-actions | GitHub Actions CI/CD workflow authoring |
| 💎 | github-markdown | GFM conventions |
| 💎 | github-writing | Interview-driven document authoring |
| 💎 | go-check | Run go vet/golangci-lint/go test, interpret output |
| 💎 | go-testing | Go testing patterns (testify, table-driven, benchmarks) |
| 💎 | js-testing | JS/TS testing with Jest, Vitest, Node test runner |
| 🔥 | kitty-gif-renderer | Integrate Kitty GIF rendering into panel extensions |
| 🔥 | kobold-housekeeping | Task tracking with panels |
| 💎 | pi-events | Event hooks reference |
| 🔥 | pi-sessions | Sessions & state management |
| 🔥 | pi-tui | TUI component building |
| 💎 | python-testing | Python testing with pytest |
| 💎 | refactoring | Refactoring patterns, SOLID, design principles |
| 🔥 | skill-designer | Build agent skills |
| 💎 | typescript-check | Run tsc/eslint, interpret errors, fix patterns |

### dragon-daemon

| | component | description |
|---|---|---|
| 📜 | dragon-daemon | Go daemon for memory consolidation, vault maintenance, and async ops |

### Hoard Infrastructure

Meta-features that serve the hoard as a whole rather than individual tools. Code artifacts live in `.github/` rather than a sub-package.

| | feature | description |
|---|---|---|
| 💭 | auto-research | GitHub Actions workflow to auto-update `researched`-state feature docs on a timer |

## Repository Layout

```
hoard/
├── berrygems/        Pi extensions (TypeScript)
│   ├── extensions/   Extension files and directories
│   ├── lib/          Shared utilities
│   ├── styles/       Writing tone files (formal, friendly, etc.)
│   ├── tsconfig.json Type checking config (resolves pi packages via symlinks)
│   └── package.json
├── morsels/          Pi skills (Markdown)
│   ├── skills/       One directory per skill, each with SKILL.md
│   └── package.json
├── den/              Internal docs (not shipped)
│   ├── features/     Per-feature docs — plans, research, reviews, current state
│   │   └── {name}/
│   │       └── AGENTS.md   Current state, what's present, links to code
│   └── moments/      Session logs and interaction captures
├── dragon-daemon/    Go daemon
│   ├── main.go
│   └── go.mod
├── package.json      Root manifest (references sub-packages)
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
// Publisher (dragon-parchment.ts)
const API_KEY = Symbol.for("hoard.parchment");
(globalThis as any)[API_KEY] = { register, close, focusPanel, ... };

// Consumer (any extension in berrygems)
const panels = (globalThis as any)[Symbol.for("hoard.parchment")];
panels?.register("my-panel", { handle, invalidate, dispose });
```

### Settings Namespace

All settings under `hoard` in `~/.pi/agent/settings.json`, with tiered nesting. Legacy `dotsPiEnhancements` flat keys are still read as fallback via `berrygems/lib/settings.ts`.

```
hoard.breath.*       Carbon tracking (enabled, gridRegion, gridIntensity)
hoard.contributor.*  AI attribution (name, email, trailerFormat)
hoard.curfew.*       Bedtime enforcement (enabled, startHour, endHour)
hoard.digestion.*    Compaction tuning (triggerMode, strategy, tieredMode, summaryThreshold, hygieneKeepResults, summaryModel, anchoredUpdates, anthropicContextEdits, tierOverrides)
hoard.guard.*        Dragon Guard (autoDetect, dogAllowedTools, keys)
hoard.herald.*       Desktop notifications (enabled, title, method, minDuration)
hoard.imageFetch.*   Image/GIF fetching (sources, preferStickers, rating, enableVibeQuery, model, queryPrompt, cacheMaxSize)
hoard.musings.*      Thinking spinner configuration
hoard.panels.*       Panel system (focusKey, defaultSkin, keybinds.*)
hoard.todos.*        Todo panels (gifVibePrompt, gifRating)
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
