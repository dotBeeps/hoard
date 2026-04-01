# 🐉 dot's pi enhancements — Ember's Hoard

> A small dog and a large dragon made these together.
> The dog is three inches tall, blue-raspberry-flavored, and fits in a cheek pouch.
> The dragon hoards knowledge and occasionally swallows the dog by accident. 🐾🔥

Custom [pi](https://github.com/badlogic/pi-mono) skills and extensions — built for fun, personality, and better agent workflows.

## What's in the hoard

### 🧠 Skills

<details>
<summary><strong><code>agent-init</code></strong> — Investigate a project and create its AGENTS.md</summary>

Scans your project directory, interviews you about preferences, and generates a high-quality `AGENTS.md` file — the universal open format for guiding AI coding agents.

- **Auto-detects** languages, frameworks, build tools, test runners, linting, CI/CD
- **Interviews** you with the `ask` tool to fill gaps the codebase can’t tell
- **Handles existing files** — updates AGENTS.md, suggests CLAUDE.md imports, notes .cursorrules
- **Cross-agent compatible** — works with Codex, Copilot, Cursor, Jules, Aider, Gemini CLI, and more
- **Real-world patterns** drawn from OpenAI Codex, Apache Airflow, and 60k+ repos

📂 [`skills/agent-init/SKILL.md`](skills/agent-init/SKILL.md)

</details>

<details>
<summary><strong><code>skill-designer</code></strong> — Design and create Agent Skills (agentskills.io spec)</summary>

The skill that makes more skills. Very dragon-hoard energy.

Covers the full authoring workflow following the [agentskills.io](https://agentskills.io/specification) specification:

- **Three skill archetypes** — Convention Guide, Tool/Task, Design/Process — each with structural patterns, templates, and word count targets
- **Frontmatter reference** — all fields, naming rules, validation
- **Description writing** — the WHAT + WHEN formula for agent discoverability
- **Progressive disclosure** — 3-tier loading strategy with token budgets
- **Quality checklist** — 15 checks across structure, content, and tone
- **Full templates** in [`references/templates.md`](skills/skill-designer/references/templates.md) for each archetype
- **Scaffolding commands** — one-liner `mkdir && cat` starters for each archetype

📂 [`skills/skill-designer/SKILL.md`](skills/skill-designer/SKILL.md)

</details>

<details>
<summary><strong><code>todo-panels</code></strong> — Open and manage floating todo panels</summary>

Display `.pi/todos` as persistent floating panels grouped by tag. Panels stay on screen while you work, auto-refresh when todos change, and only capture keyboard input when focused.

- **Tag-based grouping** — filter todos by tag into separate panels
- **Focus cycling** — `Alt+T` or `/todos focus` to cycle between panels
- **Agent layout helpers** — `suggest_layout` calculates optimal positions so agents don't do math
- **Two-tool system** — built-in `todo` for CRUD, `todo_panel` for display
- **Auto-refresh** — panels update when the `todo` tool modifies files

📂 [`skills/todo-panels/SKILL.md`](skills/todo-panels/SKILL.md)

</details>

### 🔧 Extensions

<details>
<summary><strong><code>ask</code></strong> — Interactive user input tool for agents</summary>

One tool, three modes — lets agents interview users, gather preferences, or confirm decisions without breaking flow.

| Mode | What it does |
|------|-------------|
| `select` | Pick from labeled options with descriptions, optional "Bark something…" free-text fallback |
| `confirm` | Yes/no with 🐾 |
| `text` | Free-text input with placeholder |

**Themed touches:**
- Borders randomly selected from dog & dragon patterns (`·~` `⋆·` `≈~` `~·` `⋆~` `·⸱`)
- 🐾 pawprint on confirmations, `fetched:` on selections, `barked:` on free-text
- 🐿️ "got distracted" on cancel (there was a squirrel)
- "↑↓ sniff around • Enter to fetch • Esc to wander off"
- Prompt guideline tells agents to phrase questions warmly

📂 [`extensions/ask.ts`](extensions/ask.ts)

</details>

<details>
<summary><strong><code>todo-lists</code></strong> — Persistent floating todo panels with animated GIF mascots</summary>

Non-blocking overlay panels backed by `.pi/todos`. Each panel shows todos filtered by tag with progress bars, keyboard navigation, focus management, and animated GIF mascots.

| Feature | Details |
|---------|--------|
| Backing store | `.pi/todos` (pi's built-in file-based todos) |
| Panel display | Non-capturing overlays — persistent, don't steal input |
| Focus | `Alt+T` cycles focus; `Escape` unfocuses; panels capture keys only when focused |
| Positioning | 9 anchor positions, percentage or fixed width |
| GIF mascots | Giphy search by tag name, software animation via Kitty Unicode placeholders |
| Tag mapping | Smart search queries: "bugs" → "bug fixing coding", "sprint" → "running fast" |
| Agent tool | `todo_panel` — open, close, focus, suggest_layout |
| User command | `/todos open/close/focus/status/layout/help` |
| Auto-refresh | Panels update when the built-in `todo` tool runs |
| Requirements | Kitty terminal (image protocol), ImageMagick for frame extraction |

📂 [`extensions/todo-lists.ts`](extensions/todo-lists.ts)

</details>

## Installation

```bash
# Clone the hoard
git clone https://github.com/dotBeeps/dots-pi-enhancements.git

# Or install with pi directly from GitHub
pi install https://github.com/dotBeeps/dots-pi-enhancements
```

<details>
<summary>Manual install (cherry-pick what you want)</summary>

```bash
# Install skills globally
cp -r dots-pi-enhancements/skills/agent-init ~/.pi/agent/skills/
cp -r dots-pi-enhancements/skills/skill-designer ~/.pi/agent/skills/

# Install the extension globally
cp dots-pi-enhancements/extensions/ask.ts ~/.pi/agent/extensions/

# Reload pi
# /reload
```

</details>

## Who made this

**dot** — a three-inch-tall, blue-raspberry-flavored dog. Full stack engineer. Fits in a cheek pouch. Did all the hard thinking.

**Ember** — a dragon. Hoards knowledge, shares it generously, and occasionally forgets there's a pup in her stomach mid-celebration.

## License

MIT
