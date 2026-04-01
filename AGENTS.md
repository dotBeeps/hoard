# AGENTS.md

## Project Overview

A [pi](https://github.com/badlogic/pi-mono) package containing custom Agent Skills and TUI extensions. Installable via `pi install https://github.com/dotBeeps/dots-pi-enhancements`. No build step — pi loads TypeScript extensions and Markdown skills directly.

## Setup & Development

```bash
# Install as a pi package (symlinks into pi's package registry)
pi install https://github.com/dotBeeps/dots-pi-enhancements

# Or for local development — clone and point pi at the directory
pi install ../../Development/dots-pi-enhancements
```

- **No build step** — pi loads `.ts` files directly via jiti
- **Reload after changes** — run `/reload` in pi to pick up extension edits
- **Settings file** — `~/.pi/agent/settings.json` (global), `.pi/settings.json` (project)

## Repository Structure

```
extensions/                TypeScript pi extensions (loaded by convention)
  ask.ts                   Interactive user input tool (select/confirm/text)
  panel-manager.ts         Shared panel infrastructure — singleton registry, focus cycling, hotkeys
  digestion-settings.ts    Compaction tuning panel — live-adjust context management
  todo-lists.ts            Floating todo panels with animated GIF mascots
skills/                    Agent Skills — each subdirectory has a SKILL.md
  agent-init/              Generates AGENTS.md files for projects
  dot-panels/              How to build panel extensions using the panel-manager API
  extension-designer/      Guides creation of pi extensions (tools, TUI, events)
  skill-designer/          Guides creation of new Agent Skills
  todo-panels/             Teaches agents to manage floating todo panels
package.json               pi-package manifest (convention discovery)
```

Pi auto-discovers `extensions/` and `skills/` directories — no manifest paths required.

## Architecture

### Inter-Extension Communication

Extensions **must not import each other directly** — pi's jiti loader isolates module caches per extension entry point, causing duplicate state and shortcut conflicts.

Instead, use `globalThis` with `Symbol.for()` for shared APIs:

```typescript
// Publisher (panel-manager.ts) — writes API at load time
const API_KEY = Symbol.for("dot.panels");
(globalThis as any)[API_KEY] = { register, close, focusPanel, ... };

// Consumer (any other extension) — reads with fallback
const PANELS_KEY = Symbol.for("dot.panels");
function getPanels(): any { return (globalThis as any)[PANELS_KEY]; }
const panels = getPanels();
panels?.register("my-panel", { handle, invalidate, dispose });
```

`Symbol.for()` returns the same symbol across isolated module contexts — safe for cross-extension singletons.

For event coordination between extensions, use `pi.events`:

```typescript
pi.events.emit("panels:ready");           // Publisher
pi.events.on("panels:ready", () => {});   // Consumer
```

### Settings Namespace

All package settings live under the `dotsPiEnhancements` key in `~/.pi/agent/settings.json`. Each extension documents its own keys — read with a `readSetting(key, fallback)` helper, falling back to defaults.

### Panel Extensions

Panel-manager owns shared infrastructure (focus cycling, hotkeys, TUI capture). Other extensions register panels through its globalThis API. See the `dot-panels` skill for the full integration guide.

## Adding Skills or Extensions

Use the `skill-designer` and `extension-designer` skills — they cover scaffolding, structure, quality checklists, and best practices.

## Code Style

- **TypeScript** — tabs for indentation, double quotes, semicolons
- **Markdown** — ATX headings (`#`), bullet lists with `-`, fenced code blocks with language tags
- **Skill frontmatter** — YAML between `---` fences, `name` and `description` required

## Commits

Use Conventional Commits: `<type>(<scope>): <summary>`

- `feat` for new skills or extensions
- `fix` for bug fixes
- `docs` for README or skill content updates
- `refactor` for restructuring without behavior change
- Scope is the skill or extension name: `feat(agent-init): add interview step`
- Summary ≤72 chars, imperative mood, no trailing period
- Update `README.md` when adding or removing skills/extensions
