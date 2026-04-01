/**
 * Digestion Settings — Live-tweakable floating panel for compaction configuration.
 *
 * Because when a dragon processes context, it's not "compaction" — it's digestion.
 *
 * Features:
 * - Non-blocking overlay panel showing current compaction settings + context usage
 * - Toggle auto-compaction on/off, adjust reserveTokens and keepRecentTokens
 * - Writes changes to project .pi/settings.json for persistence across sessions
 * - Hooks session_before_compact as a safety net for live enforcement
 * - `/digestion` command to open/close the panel
 * - Alt+C shortcut to toggle panel visibility
 * - Press `g` when focused to copy values from global config
 * - Context usage bar updates on turn_end events
 *
 * A small dog and a large dragon made this together.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import type { Component, OverlayHandle, TUI } from "@mariozechner/pi-tui";
import { matchesKey, Key, Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
// ── Panel Manager Access ──
// Panel manager API is published to globalThis by panel-manager.ts extension.
// No direct imports — avoids jiti module isolation issues.
const PANELS_KEY = Symbol.for("dot.panels");
function getPanels(): any {
	return (globalThis as any)[PANELS_KEY];
}
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

// ── Types ──

interface CompactionSettings {
	enabled: boolean;
	reserveTokens: number;
	keepRecentTokens: number;
}

interface ContextUsageInfo {
	tokens: number | null;
	contextWindow: number | null;
	percent: number | null;
}

// ── Constants ──

const DEFAULT_SETTINGS: CompactionSettings = {
	enabled: true,
	reserveTokens: 16384,
	keepRecentTokens: 20000,
};

/** Turn a matchesKey-style code into a display label. */
function keyLabel(code: string): string {
	return code.split("+").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("+");
}

/** Preset values for reserveTokens — what you want available for the LLM's response */
const RESERVE_PRESETS = [4096, 8192, 16384, 32768, 65536];

/** Preset values for keepRecentTokens — how much recent context to preserve */
const KEEP_RECENT_PRESETS = [5000, 10000, 20000, 40000, 80000];

/** Key to copy settings from global config (configurable via dotsPiEnhancements.digestionCopyGlobalKey) */
const COPY_GLOBAL_KEY = readEnhancementSetting<string>("digestionCopyGlobalKey", "g");
const COPY_GLOBAL_LABEL = keyLabel(COPY_GLOBAL_KEY);

// ── Settings I/O ──

function getGlobalSettingsPath(): string {
	return join(process.env.HOME || process.env.USERPROFILE || homedir(), ".pi", "agent", "settings.json");
}

function getProjectSettingsPath(cwd: string): string {
	return join(cwd, ".pi", "settings.json");
}

function readSettingsFile(path: string): Record<string, unknown> {
	try {
		if (!existsSync(path)) return {};
		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

const SETTINGS_NAMESPACE = "dotsPiEnhancements";

function readEnhancementSetting<T>(key: string, fallback: T): T {
	try {
		const settings = readSettingsFile(getGlobalSettingsPath());
		const ns = settings[SETTINGS_NAMESPACE];
		if (typeof ns !== "object" || ns === null) return fallback;
		return key in ns ? (ns as Record<string, unknown>)[key] as T : fallback;
	} catch { return fallback; }
}

function readCompactionSettings(cwd: string): CompactionSettings {
	const global = readSettingsFile(getGlobalSettingsPath());
	const project = readSettingsFile(getProjectSettingsPath(cwd));

	// Project overrides global, both override defaults
	const globalCompaction = (global.compaction ?? {}) as Partial<CompactionSettings>;
	const projectCompaction = (project.compaction ?? {}) as Partial<CompactionSettings>;

	return {
		enabled: projectCompaction.enabled ?? globalCompaction.enabled ?? DEFAULT_SETTINGS.enabled,
		reserveTokens:
			projectCompaction.reserveTokens ?? globalCompaction.reserveTokens ?? DEFAULT_SETTINGS.reserveTokens,
		keepRecentTokens:
			projectCompaction.keepRecentTokens ??
			globalCompaction.keepRecentTokens ??
			DEFAULT_SETTINGS.keepRecentTokens,
	};
}

function writeCompactionSetting(cwd: string, key: keyof CompactionSettings, value: unknown): boolean {
	try {
		const path = getProjectSettingsPath(cwd);
		const settings = readSettingsFile(path);
		const compaction =
			typeof settings.compaction === "object" && settings.compaction !== null
				? (settings.compaction as Record<string, unknown>)
				: {};
		compaction[key] = value;
		settings.compaction = compaction;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
		return true;
	} catch {
		return false;
	}
}

function readGlobalCompactionSettings(): CompactionSettings {
	const global = readSettingsFile(getGlobalSettingsPath());
	const gc = (global.compaction ?? {}) as Partial<CompactionSettings>;
	return {
		enabled: gc.enabled ?? DEFAULT_SETTINGS.enabled,
		reserveTokens: gc.reserveTokens ?? DEFAULT_SETTINGS.reserveTokens,
		keepRecentTokens: gc.keepRecentTokens ?? DEFAULT_SETTINGS.keepRecentTokens,
	};
}

function writeAllCompactionSettings(cwd: string, settings: CompactionSettings): boolean {
	try {
		const path = getProjectSettingsPath(cwd);
		const file = readSettingsFile(path);
		file.compaction = { ...settings };
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
		return true;
	} catch {
		return false;
	}
}

// ── Helpers ──

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
	return String(n);
}

function cyclePreset(current: number, presets: number[], direction: 1 | -1): number {
	// Find closest preset index
	let closestIdx = 0;
	let closestDist = Math.abs(current - presets[0]!);
	for (let i = 1; i < presets.length; i++) {
		const dist = Math.abs(current - presets[i]!);
		if (dist < closestDist) {
			closestIdx = i;
			closestDist = dist;
		}
	}
	const nextIdx = Math.max(0, Math.min(presets.length - 1, closestIdx + direction));
	return presets[nextIdx]!;
}

// ── Panel Component ──

class CompactionPanelComponent implements Component {
	private theme: Theme;
	private tui: TUI;
	private cwd: string;
	private settings: CompactionSettings;
	private contextUsage: ContextUsageInfo = {
		tokens: null,
		contextWindow: null,
		percent: null,
	};
	private selectedIndex = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];
	private handle: OverlayHandle | null = null;
	/** Live override — if set, session_before_compact uses these instead of file */
	public liveSettings: CompactionSettings;

	private readonly items = [
		{ id: "enabled", label: "Auto-Compaction" },
		{ id: "reserveTokens", label: "Reserve Tokens" },
		{ id: "keepRecentTokens", label: "Keep Recent" },
		{ id: "compact-now", label: "⚡ Compact Now" },
	] as const;

	constructor(theme: Theme, tui: TUI, cwd: string) {
		this.theme = theme;
		this.tui = tui;
		this.cwd = cwd;
		this.settings = readCompactionSettings(cwd);
		this.liveSettings = { ...this.settings };
	}

	setHandle(handle: OverlayHandle): void {
		this.handle = handle;
	}

	updateContextUsage(usage: ContextUsageInfo): void {
		this.contextUsage = usage;
		this.invalidate();
		this.tui.requestRender();
	}

	refresh(): void {
		this.settings = readCompactionSettings(this.cwd);
		this.liveSettings = { ...this.settings };
		this.invalidate();
	}

	private applyChange(key: keyof CompactionSettings, value: unknown): void {
		(this.liveSettings as Record<string, unknown>)[key] = value;
		writeCompactionSetting(this.cwd, key, value);
		this.settings = { ...this.liveSettings };
		this.invalidate();
		this.tui.requestRender();
	}

	private copyFromGlobal(): void {
		const global = readGlobalCompactionSettings();
		this.liveSettings = { ...global };
		writeAllCompactionSettings(this.cwd, global);
		this.settings = { ...global };
		this.invalidate();
		this.tui.requestRender();
	}

	// Reference to ctx.compact — set by the extension after construction
	public triggerCompact?: () => void;

	handleInput(data: string): void {
		if (matchesKey(data, COPY_GLOBAL_KEY)) {
			this.copyFromGlobal();
			return;
		}

		if (matchesKey(data, Key.up) && this.selectedIndex > 0) {
			this.selectedIndex--;
			this.invalidate();
			this.tui.requestRender();
		} else if (matchesKey(data, Key.down) && this.selectedIndex < this.items.length - 1) {
			this.selectedIndex++;
			this.invalidate();
			this.tui.requestRender();
		} else if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
			this.activateItem();
		} else if (matchesKey(data, Key.left)) {
			this.adjustItem(-1);
		} else if (matchesKey(data, Key.right)) {
			this.adjustItem(1);
		}
	}

	private activateItem(): void {
		const item = this.items[this.selectedIndex];
		switch (item.id) {
			case "enabled":
				this.applyChange("enabled", !this.liveSettings.enabled);
				break;
			case "reserveTokens":
				this.applyChange("reserveTokens", cyclePreset(this.liveSettings.reserveTokens, RESERVE_PRESETS, 1));
				break;
			case "keepRecentTokens":
				this.applyChange(
					"keepRecentTokens",
					cyclePreset(this.liveSettings.keepRecentTokens, KEEP_RECENT_PRESETS, 1),
				);
				break;
			case "compact-now":
				this.triggerCompact?.();
				break;
		}
	}

	private adjustItem(direction: 1 | -1): void {
		const item = this.items[this.selectedIndex];
		switch (item.id) {
			case "enabled":
				this.applyChange("enabled", !this.liveSettings.enabled);
				break;
			case "reserveTokens":
				this.applyChange(
					"reserveTokens",
					cyclePreset(this.liveSettings.reserveTokens, RESERVE_PRESETS, direction),
				);
				break;
			case "keepRecentTokens":
				this.applyChange(
					"keepRecentTokens",
					cyclePreset(this.liveSettings.keepRecentTokens, KEEP_RECENT_PRESETS, direction),
				);
				break;
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const th = this.theme;
		const focused = this.handle?.isFocused() ?? false;
		const innerW = Math.max(20, width - 2);
		const lines: string[] = [];
		const borderColor = focused ? "accent" : "border";
		const border = (c: string) => th.fg(borderColor, c);
		const padLine = (s: string): string => {
			const raw = truncateToWidth(s, innerW);
			return raw + " ".repeat(Math.max(0, innerW - visibleWidth(raw)));
		};

		// ── Title ──
		const titleText = " 🐉 Digestion Settings ";
		const titleStyled = focused ? th.fg("accent", th.bold(titleText)) : th.fg("text", th.bold(titleText));
		const titleW = visibleWidth(titleText);
		const lp = Math.max(1, Math.floor((innerW - titleW) / 2));
		const rp = Math.max(1, innerW - titleW - lp);
		lines.push(border("╭") + border("─".repeat(lp)) + titleStyled + border("─".repeat(rp)) + border("╮"));

		// ── Context Usage Bar ──
		lines.push(border("│") + padLine("") + border("│"));
		if (this.contextUsage.tokens !== null && this.contextUsage.contextWindow !== null) {
			const pct = this.contextUsage.percent ?? 0;
			const barW = Math.min(20, innerW - 16);
			if (barW >= 5) {
				const filled = Math.round((pct / 100) * barW);
				const barColor = pct > 80 ? "error" : pct > 60 ? "warning" : "success";
				const bar = th.fg(barColor, "█".repeat(filled)) + th.fg("dim", "░".repeat(barW - filled));
				lines.push(border("│") + padLine(`  Context: ${bar} ${pct}%`) + border("│"));
				lines.push(
					border("│") +
						padLine(
							th.fg(
								"dim",
								`  ${formatTokens(this.contextUsage.tokens)} / ${formatTokens(this.contextUsage.contextWindow)} tokens`,
							),
						) +
						border("│"),
				);
			}
		} else {
			lines.push(border("│") + padLine(th.fg("dim", "  Context: waiting for data…")) + border("│"));
		}

		// ── Compaction threshold indicator ──
		if (this.contextUsage.contextWindow !== null) {
			const threshold = this.contextUsage.contextWindow - this.liveSettings.reserveTokens;
			lines.push(
				border("│") + padLine(th.fg("dim", `  Triggers at: ${formatTokens(threshold)} tokens`)) + border("│"),
			);
		}

		lines.push(border("│") + padLine("") + border("│"));
		lines.push(border("│") + padLine(th.fg("dim", "  " + "─".repeat(Math.min(innerW - 4, 30)))) + border("│"));
		lines.push(border("│") + padLine("") + border("│"));

		// ── Settings Items ──
		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i]!;
			const isSelected = focused && i === this.selectedIndex;
			const pointer = isSelected ? th.fg("accent", "▸ ") : "  ";
			const labelColor = isSelected ? "accent" : "text";

			let valueStr: string;
			switch (item.id) {
				case "enabled":
					valueStr = this.liveSettings.enabled ? th.fg("success", "● ON") : th.fg("error", "○ OFF");
					break;
				case "reserveTokens":
					valueStr =
						th.fg("muted", "◂ ") +
						th.fg("text", formatTokens(this.liveSettings.reserveTokens)) +
						th.fg("muted", " ▸");
					break;
				case "keepRecentTokens":
					valueStr =
						th.fg("muted", "◂ ") +
						th.fg("text", formatTokens(this.liveSettings.keepRecentTokens)) +
						th.fg("muted", " ▸");
					break;
				case "compact-now":
					valueStr = "";
					break;
				default:
					valueStr = "";
			}

			const label = th.fg(labelColor, item.label);
			if (valueStr) {
				lines.push(border("│") + padLine(`${pointer}${label}  ${valueStr}`) + border("│"));
			} else {
				lines.push(border("│") + padLine(`${pointer}${label}`) + border("│"));
			}
		}

		// ── Help ──
		lines.push(border("│") + padLine("") + border("│"));
		const kh = getPanels()?.keyHints;
		const help = focused
			? th.fg("dim", `↑↓ nav · ←→/Space adjust · ${COPY_GLOBAL_LABEL} global · ${kh?.focused ?? "Q close · Escape unfocus"}`)
			: th.fg("dim", `${kh?.unfocused ?? "Alt+T focus"} · /digestion help`);
		lines.push(border("│") + padLine("  " + help) + border("│"));

		// ── Bottom border ──
		lines.push(border("╰") + border("─".repeat(innerW)) + border("╯"));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ── Extension ──

const PANEL_ID = "digestion";

export default function (pi: ExtensionAPI) {
	let ctxRef: ExtensionContext | null = null;
	let panelComponent: CompactionPanelComponent | null = null;

	// ── Panel Management ──
	function openPanel(): string {
		const panels = getPanels();
		const tui = panels?.tui;
		const theme = panels?.theme;
		if (!tui || !theme) return "Error: TUI not available (non-interactive mode)";

		if (panels.isOpen(PANEL_ID)) {
			panelComponent?.refresh();
			panels.requestRender();
			return "Digestion panel refreshed";
		}

		const component = new CompactionPanelComponent(theme, tui, panels.cwd);
		const wrapped = panels.wrapComponent(PANEL_ID, component);
		const handle = tui.showOverlay(wrapped, {
			nonCapturing: true,
			anchor: "top-right",
			width: "35%",
			minWidth: 36,
			maxHeight: "60%",
			margin: 1,
		});

		component.setHandle(handle);
		component.triggerCompact = () => {
			if (ctxRef) {
				ctxRef.compact({
					onComplete: () => ctxRef?.hasUI && ctxRef.ui.notify("Compaction completed!", "info"),
					onError: (err: Error) =>
						ctxRef?.hasUI && ctxRef.ui.notify(`Compaction failed: ${err.message}`, "error"),
				});
			}
		};

		// Populate initial context usage
		if (ctxRef) {
			const usage = ctxRef.getContextUsage();
			if (usage) {
				component.updateContextUsage({
					tokens: usage.tokens ?? null,
					contextWindow: usage.contextWindow ?? null,
					percent: usage.percent ?? null,
				});
			}
		}

		panelComponent = component;
		panels.register(PANEL_ID, {
			handle,
			invalidate: () => component.invalidate(),
			handleInput: (data) => component.handleInput(data),
			onClose: () => {
				panelComponent = null;
			},
		});
		return "Digestion settings panel opened";
	}

	function closePanel(): string {
		const panels = getPanels();
		if (!panels?.isOpen(PANEL_ID)) return "No panel open";
		panels.close(PANEL_ID); // onClose clears panelComponent
		return "Digestion panel closed";
	}

	function togglePanel(): string {
		if (getPanels()?.isOpen(PANEL_ID)) return closePanel();
		return openPanel();
	}

	// ── Context Usage Updates ──
	function updateContextUsage(ctx: ExtensionContext): void {
		if (!panelComponent) return;
		const usage = ctx.getContextUsage();
		if (usage) {
			panelComponent.updateContextUsage({
				tokens: usage.tokens ?? null,
				contextWindow: usage.contextWindow ?? null,
				percent: usage.percent ?? null,
			});
		}
	}

	// ── Events ──
	pi.on("session_start", async (_event, ctx) => {
		ctxRef = ctx;
	});
	pi.on("session_switch", async (_event, ctx) => {
		panelComponent = null;
		ctxRef = ctx;
	});
	pi.on("session_shutdown", async () => {
		panelComponent = null;
	});

	// Update context usage display after each turn
	pi.on("turn_end", async (_event, ctx) => updateContextUsage(ctx));
	pi.on("session_compact", async (_event, ctx) => updateContextUsage(ctx));

	// ── Compaction Hook (safety net for live enforcement) ──
	pi.on("session_before_compact", async () => {
		if (!panelComponent) return;

		// If the panel says compaction is disabled, cancel it
		if (!panelComponent.liveSettings.enabled) {
			return { cancel: true };
		}

		// Otherwise let pi handle it with whatever settings it read from the file.
		// The file should already be updated since we write on every change,
		// but if pi cached old values, the hook acts as our safety net.
		// Note: we can't override reserveTokens/keepRecentTokens from the hook
		// (only cancel or provide custom summary), so the file write is the
		// primary mechanism for numeric settings. The hook handles the on/off toggle.
		return;
	});

	// ── /digestion Command ──
	pi.registerCommand("digestion", {
		description: "Manage digestion settings panel (compaction tuning)",
		handler: async (args, ctx) => {
			const subcmd = (args ?? "").trim().toLowerCase();
			switch (subcmd) {
				case "open":
				case "show":
					ctx.ui.notify(openPanel(), "info");
					return;
				case "close":
				case "hide":
					ctx.ui.notify(closePanel(), "info");
					return;
				case "toggle":
				case "":
					ctx.ui.notify(togglePanel(), "info");
					return;
				case "status": {
					const settings = readCompactionSettings(getPanels()?.cwd ?? process.cwd());
					const usage = ctx.getContextUsage();
					const statusLines = [
						`Auto-compaction: ${settings.enabled ? "ON" : "OFF"}`,
						`Reserve tokens: ${formatTokens(settings.reserveTokens)}`,
						`Keep recent: ${formatTokens(settings.keepRecentTokens)}`,
					];
					if (usage?.tokens != null && usage?.contextWindow != null) {
						const threshold = usage.contextWindow - settings.reserveTokens;
						statusLines.push(
							`Context: ${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)} (${usage.percent ?? 0}%)`,
						);
						statusLines.push(`Compaction triggers at: ${formatTokens(threshold)}`);
					}
					ctx.ui.notify(statusLines.join("\n"), "info");
					return;
				}
				default:
					{
						const kh = getPanels()?.keyHints;
						ctx.ui.notify(
							[
								"🐉 Digestion Settings — compaction tuning for dragons",
								"",
								"  /digestion               Toggle panel",
								"  /digestion open          Open panel",
								"  /digestion close         Close panel",
								"  /digestion status        Show current settings",
								"",
								"When focused: ↑↓ navigate, ←→ or Space to adjust,",
								`${COPY_GLOBAL_LABEL} to copy from global config,`,
								"Enter on 'Compact Now' to trigger manually,",
								`${kh?.focusKey ?? "Alt+T"} to cycle focus, ${kh?.closeKey ?? "Q"} to close, ${kh?.unfocusKey ?? "Escape"} to unfocus`,
							].join("\n"),
							"info",
						);
					}
			}
		},
	});
}
