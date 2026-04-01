---
name: dot-panels
description: "Build and integrate floating overlay panels using the panel-manager API. Use when creating new panel extensions, adding panels to existing extensions, or working with the globalThis panel infrastructure."
---

# Panel Development

Build floating overlay panels that integrate with the shared panel-manager infrastructure — focus cycling, configurable hotkeys, and consistent hint bars come free.

## Panel Manager API

Panel-manager publishes its API to `globalThis` at extension load time. Access it from any extension:

```typescript
const PANELS_KEY = Symbol.for("dot.panels");
function getPanels(): any { return (globalThis as any)[PANELS_KEY]; }
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tui` | `TUI \| null` | TUI reference (available after session_start) |
| `theme` | `Theme \| null` | Current theme |
| `cwd` | `string` | Working directory |
| `size` | `number` | Count of registered panels |

### Methods

| Method | Description |
|--------|-------------|
| `register(id, panel)` | Register a panel with the manager |
| `close(id)` | Close and dispose a panel |
| `closeAll()` | Close all panels |
| `isOpen(id)` | Check if a panel is registered |
| `get(id)` | Get a panel's ManagedPanel entry |
| `list()` | All registered panels as `{ id }[]` |
| `focusPanel(id)` | Focus a specific panel |
| `cycleFocus()` | Cycle focus to next panel |
| `unfocusAll()` | Remove focus from all panels |
| `requestRender()` | Trigger TUI re-render |
| `wrapComponent(id, component)` | Wrap a component for shared key routing |

### keyHints

Panel-manager exposes display labels for all shared hotkeys. Use these instead of hardcoding key names:

```typescript
const kh = getPanels()?.keyHints;
kh.focusKey    // "Alt+T" (or whatever user configured)
kh.closeKey    // "Q"
kh.unfocusKey  // "Escape"
kh.focused     // "Q close · Escape unfocus" — hint fragment for focused panels
kh.unfocused   // "Alt+T focus" — hint fragment for unfocused panels
```

## Adding a Panel — Step by Step

### 1. Access the API and check readiness

```typescript
const panels = getPanels();
if (!panels?.tui || !panels?.theme) return "TUI not available";
```

### 2. Create your component

Implement `render(width): string[]`, `invalidate(): void`, and `handleInput(data): void`. Handle only your extension-specific keys — shared keys (close, unfocus, cycle-focus) are routed by `wrapComponent`.

### 3. Wrap and show

```typescript
const PANEL_ID = "my-ext:main";
const component = new MyPanelComponent(panels.theme, panels.tui);
const wrapped = panels.wrapComponent(PANEL_ID, component);
const handle = panels.tui.showOverlay(wrapped, {
	nonCapturing: true,       // Panel doesn't steal input when unfocused
	anchor: "right-center",
	width: "30%",
	minWidth: 30,
	maxHeight: "90%",
	margin: 1,
});
component.setHandle(handle);  // So component can check isFocused()
```

### 4. Register with the manager

```typescript
panels.register(PANEL_ID, {
	handle,                                     // OverlayHandle from showOverlay
	invalidate: () => component.invalidate(),   // Called on focus changes, resize
	handleInput: (data) => component.handleInput(data),  // Extension-specific keys
	dispose: () => component.cleanup(),         // Resource cleanup
	onClose: () => myComponents.delete(id),     // Update your own tracking state
});
```

### 5. Clean up on session events

```typescript
pi.on("session_start", async (_event, ctx) => { extCtxRef = ctx; });
pi.on("session_switch", async (_event, ctx) => { myComponents.clear(); extCtxRef = ctx; });
pi.on("session_shutdown", async () => { myComponents.clear(); });
```

Panel-manager handles `closeAll()` on session switch/shutdown — your `onClose` callback fires for each panel.

## Configurable Hotkeys

All shared panel keys read from `dotsPiEnhancements` in `~/.pi/agent/settings.json`:

| Setting | Default | Action |
|---------|---------|--------|
| `panelFocusKey` | `alt+t` | Cycle focus between panels |
| `panelCloseKey` | `q` | Close focused panel |
| `panelUnfocusKey` | `escape` | Unfocus panel |

Extension-specific keys follow the same pattern — read from settings with a default:

```typescript
const MY_KEY = readSetting<string>("myExtensionKey", "g");
const MY_LABEL = keyLabel(MY_KEY);
```

## TUI Rendering Conventions

### Focus-aware borders

```typescript
const focused = this.handle?.isFocused() ?? false;
const border = (s: string) => th.fg(focused ? "accent" : "border", s);
```

### Cached rendering

```typescript
render(width: number): string[] {
	if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
	// ... build lines ...
	this.cachedWidth = width;
	this.cachedLines = lines;
	return lines;
}
invalidate(): void { this.cachedWidth = undefined; this.cachedLines = undefined; }
```

### Hint bar

Place at the bottom of the panel, showing different hints based on focus state:

```typescript
const kh = getPanels()?.keyHints;
const hint = focused
	? th.fg("dim", `↑↓ nav · Space toggle · ${kh?.focused ?? "Q close · Escape unfocus"}`)
	: th.fg("dim", `${kh?.unfocused ?? "Alt+T focus"} · /mycommand help`);
```

### Width safety

Use `truncateToWidth()` for any line that includes ANSI escapes — never slice strings directly, ANSI codes have invisible width.

## Anti-Patterns

- **Don't import panel-manager directly** — use `globalThis[Symbol.for("dot.panels")]`. Direct imports create duplicate state due to jiti module isolation.
- **Don't handle Esc, Q, or the focus key in your component** — `wrapComponent` routes these to the manager before your `handleInput` runs.
- **Don't register your own focus shortcut** — panel-manager owns `registerShortcut` for the focus key. Adding another causes conflicts.
- **Don't hardcode key labels in hints** — use `keyHints` so hints update when the user changes their keybindings.
- **Don't forget `nonCapturing: true`** — without it, the overlay steals all keyboard input even when unfocused.
