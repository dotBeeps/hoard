/**
 * Lint Panel — Live diagnostics via LSP + floating panel.
 *
 * Connects to typescript-language-server for real-time type errors.
 * Falls back to tsc subprocess when LSP isn't available.
 * Auto-refreshes on file changes via fs.watch.
 *
 * A three-inch dog wrote this inside a dragon's stomach.
 * She was about 2/3 goop at the time and still wagging.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { execSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { existsSync, watch, type FSWatcher } from "node:fs";
import {
	renderHeader, renderFooter, padContentLine,
	type PanelSkin,
} from "../lib/panel-chrome.ts";
import { LspClient, type LspDiagnostic, type LspDiagnosticEvent } from "../lib/lsp-client.ts";

// ── Panel Manager Access ──

const PANELS_KEY = Symbol.for("dot.panels");
function getPanels(): any {
	return (globalThis as any)[PANELS_KEY];
}

// ── Types ──

interface Diagnostic {
	file: string;
	relPath: string;
	line: number;
	col: number;
	code: string;
	message: string;
	severity: "error" | "warning" | "info" | "hint";
}

interface FileGroup {
	file: string;
	relPath: string;
	diagnostics: Diagnostic[];
	expanded: boolean;
}

// ── tsc Fallback ──

function findTsconfig(cwd: string): string | null {
	const candidates = [
		resolve(cwd, "tsconfig.json"),
		resolve(cwd, "berrygems/tsconfig.json"),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}

function parseTscOutput(output: string, cwd: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const line of output.split("\n")) {
		const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
		if (match) {
			diagnostics.push({
				file: resolve(cwd, match[1]!),
				relPath: relative(cwd, resolve(cwd, match[1]!)),
				line: parseInt(match[2]!, 10),
				col: parseInt(match[3]!, 10),
				code: match[4]!,
				message: match[5]!,
				severity: "error",
			});
		}
	}
	return diagnostics;
}

function runTsc(cwd: string, tsconfigPath: string): { diagnostics: Diagnostic[]; duration: number } {
	const start = Date.now();
	let output = "";
	try {
		execSync(`tsc --project ${tsconfigPath}`, {
			cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30_000,
		});
	} catch (err: any) {
		output = (err.stdout ?? "") + (err.stderr ?? "");
	}
	return { diagnostics: parseTscOutput(output, cwd), duration: Date.now() - start };
}

// ── Diagnostic Grouping ──

function groupByFile(diagnostics: Diagnostic[], cwd: string): FileGroup[] {
	const groups = new Map<string, FileGroup>();
	for (const d of diagnostics) {
		let group = groups.get(d.file);
		if (!group) {
			group = { file: d.file, relPath: d.relPath, diagnostics: [], expanded: false };
			groups.set(d.file, group);
		}
		group.diagnostics.push(d);
	}
	return [...groups.values()].sort((a, b) => a.relPath.localeCompare(b.relPath));
}

// ── LSP Manager (singleton per extension lifecycle) ──

class LspManager {
	private client: LspClient | null = null;
	private watchers: FSWatcher[] = [];
	private allDiagnostics = new Map<string, LspDiagnostic[]>();
	private listeners = new Set<() => void>();
	private cwd: string;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private _ready = false;
	private _starting = false;
	private _error: string | null = null;

	constructor(cwd: string) {
		this.cwd = cwd;
	}

	get ready(): boolean { return this._ready; }
	get error(): string | null { return this._error; }

	/** Subscribe to diagnostic updates. Returns unsubscribe function. */
	onUpdate(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notifyListeners(): void {
		for (const fn of this.listeners) fn();
	}

	/** Get all current diagnostics as flat array. */
	getAllDiagnostics(): Diagnostic[] {
		const all: Diagnostic[] = [];
		for (const [, diags] of this.allDiagnostics) {
			for (const d of diags) {
				all.push({
					file: d.file,
					relPath: d.relPath,
					line: d.line,
					col: d.col,
					code: d.code ? `TS${d.code}` : "",
					message: d.message,
					severity: d.severity,
				});
			}
		}
		return all;
	}

	/** Get error count. */
	getErrorCount(): number {
		let count = 0;
		for (const [, diags] of this.allDiagnostics) {
			count += diags.filter(d => d.severity === "error").length;
		}
		return count;
	}

	/** Get total diagnostic count. */
	getTotalCount(): number {
		let count = 0;
		for (const [, diags] of this.allDiagnostics) {
			count += diags.length;
		}
		return count;
	}

	/** Start the LSP server and file watchers. */
	async start(): Promise<void> {
		if (this._ready || this._starting) return;
		this._starting = true;
		this._error = null;

		try {
			this.client = new LspClient(this.cwd);

			this.client.on("diagnostics", (event: LspDiagnosticEvent) => {
				this.allDiagnostics.set(event.uri, event.diagnostics);
				this.notifyListeners();
			});

			this.client.on("error", (err: Error) => {
				this._error = err.message;
				this.notifyListeners();
			});

			this.client.on("exit", (code: number) => {
				if (!this._ready) return;
				this._ready = false;
				this._error = `LSP exited with code ${code}`;
				this.notifyListeners();
			});

			await this.client.start();
			this._ready = true;
			this._starting = false;

			// Open all TS files in berrygems
			this.client.openDirectory("berrygems/extensions");
			this.client.openDirectory("berrygems/lib");

			// Watch for file changes
			this.watchDirectory("berrygems/extensions");
			this.watchDirectory("berrygems/lib");

			this.notifyListeners();
		} catch (err: any) {
			this._starting = false;
			this._error = `Failed to start LSP: ${err.message}`;
			this.notifyListeners();
		}
	}

	private watchDirectory(dir: string): void {
		const absDir = resolve(this.cwd, dir);
		if (!existsSync(absDir)) return;

		try {
			const watcher = watch(absDir, { recursive: true }, (_event, filename) => {
				if (!filename?.endsWith(".ts")) return;
				this.handleFileChange(resolve(absDir, filename));
			});
			this.watchers.push(watcher);
		} catch {
			// fs.watch may not support recursive on all platforms
			// Fall back to non-recursive
			try {
				const watcher = watch(absDir, (_event, filename) => {
					if (!filename?.endsWith(".ts")) return;
					this.handleFileChange(resolve(absDir, filename));
				});
				this.watchers.push(watcher);
			} catch { /* give up on watching this dir */ }
		}
	}

	private handleFileChange(filePath: string): void {
		// Debounce: wait 300ms after last change before notifying LSP
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			if (this.client?.isReady) {
				const rel = relative(this.cwd, filePath);
				this.client.notifySaved(rel);
			}
		}, 300);
	}

	/** Force a refresh by re-reading all open files. */
	refresh(): void {
		if (this.client?.isReady) {
			this.client.openDirectory("berrygems/extensions");
			this.client.openDirectory("berrygems/lib");
		}
	}

	async dispose(): Promise<void> {
		for (const w of this.watchers) w.close();
		this.watchers = [];
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		await this.client?.dispose();
		this.client = null;
		this._ready = false;
		this.listeners.clear();
		this.allDiagnostics.clear();
	}
}

// ── Panel Component ──

class LintPanelComponent {
	private panelCtx: any;
	private cwd: string;
	private theme!: Theme;
	private tui!: TUI;
	private lsp: LspManager;
	private groups: FileGroup[] = [];
	private totalErrors = 0;
	private totalDiagnostics = 0;
	private selectedIndex = 0;
	private cache: string[] | null = null;
	private unsubscribe: (() => void) | null = null;
	private mode: "lsp" | "tsc" = "lsp";

	constructor(options: { panelCtx: any; cwd: string; lsp: LspManager }) {
		this.panelCtx = options.panelCtx;
		this.cwd = options.cwd;
		this.lsp = options.lsp;
		this.theme = options.panelCtx.theme;
		this.tui = options.panelCtx.tui;

		// Subscribe to LSP diagnostic updates
		this.unsubscribe = this.lsp.onUpdate(() => {
			this.rebuildFromLsp();
			this.cache = null;
			this.tui?.requestRender();
		});

		// Initial rebuild if LSP already has data
		if (this.lsp.ready) {
			this.rebuildFromLsp();
		}
	}

	private rebuildFromLsp(): void {
		const all = this.lsp.getAllDiagnostics();
		this.totalErrors = this.lsp.getErrorCount();
		this.totalDiagnostics = this.lsp.getTotalCount();
		this.mode = "lsp";

		// Rebuild groups, preserving expansion state
		const oldExpanded = new Set(this.groups.filter(g => g.expanded).map(g => g.relPath));
		this.groups = groupByFile(all, this.cwd);

		// Restore expansion — auto-expand if few groups
		if (oldExpanded.size > 0) {
			for (const g of this.groups) {
				if (oldExpanded.has(g.relPath)) g.expanded = true;
			}
		} else if (this.groups.length <= 3) {
			for (const g of this.groups) g.expanded = true;
		}
	}

	/** Fallback: run tsc directly. */
	runTscFallback(): void {
		const tsconfig = findTsconfig(this.cwd);
		if (!tsconfig) return;

		this.mode = "tsc";
		this.cache = null;
		this.tui?.requestRender();

		setTimeout(() => {
			const result = runTsc(this.cwd, tsconfig);
			this.groups = groupByFile(result.diagnostics, this.cwd);
			this.totalErrors = result.diagnostics.length;
			this.totalDiagnostics = result.diagnostics.length;
			if (this.groups.length <= 3) {
				for (const g of this.groups) g.expanded = true;
			}
			this.cache = null;
			this.tui?.requestRender();
		}, 0);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "r")) {
			this.lsp.refresh();
			return;
		}
		if (matchesKey(data, "t")) {
			// Toggle between LSP and tsc mode
			if (this.mode === "lsp") {
				this.runTscFallback();
			} else {
				this.rebuildFromLsp();
				this.cache = null;
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(data, "j") || matchesKey(data, Key.down)) {
			this.selectedIndex = Math.min(this.selectedIndex + 1, this.getSelectableCount() - 1);
			this.cache = null;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, "k") || matchesKey(data, Key.up)) {
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
			this.cache = null;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
			this.toggleExpand();
			return;
		}
	}

	private getSelectableCount(): number {
		let count = 0;
		for (const g of this.groups) {
			count++;
			if (g.expanded) count += g.diagnostics.length;
		}
		return Math.max(count, 1);
	}

	private toggleExpand(): void {
		let idx = 0;
		for (const g of this.groups) {
			if (idx === this.selectedIndex) {
				g.expanded = !g.expanded;
				this.cache = null;
				this.tui.requestRender();
				return;
			}
			idx++;
			if (g.expanded) idx += g.diagnostics.length;
		}
	}

	invalidate(): void {
		this.theme = this.panelCtx.theme;
		this.tui = this.panelCtx.tui;
		this.cache = null;
	}

	dispose(): void {
		this.unsubscribe?.();
	}

	render(width: number): string[] {
		if (this.cache) return this.cache;

		const th = this.theme;
		const skin: PanelSkin = this.panelCtx.skin();
		const focused = this.panelCtx.isFocused();

		const modeLabel = this.mode === "lsp" ? "LSP" : "tsc";
		const statusIcon = !this.lsp.ready && this.mode === "lsp"
			? "⏳"
			: this.totalErrors === 0
				? "✅"
				: "⚠️";

		const chromeOpts = {
			theme: th,
			skin,
			focused,
			title: this.totalErrors === 0
				? `${statusIcon} Lint — Clean`
				: `${statusIcon} Lint — ${this.totalErrors} error${this.totalErrors === 1 ? "" : "s"}`,
			footerHint: focused
				? `r refresh · t ${this.mode === "lsp" ? "tsc" : "lsp"} · j/k · ⏎`
				: undefined,
			scrollInfo: this.totalDiagnostics > 0
				? `${modeLabel} · ${this.totalDiagnostics} total`
				: modeLabel,
		};

		const lines: string[] = [];
		lines.push(...renderHeader(width, chromeOpts));

		if (!this.lsp.ready && this.mode === "lsp") {
			const status = this.lsp.error
				? th.fg("error", `  ${this.lsp.error}`)
				: th.fg("dim", "  Starting LSP...");
			lines.push(padContentLine(status, width, chromeOpts));
			lines.push(padContentLine("", width, chromeOpts));
		} else if (this.totalErrors === 0) {
			lines.push(padContentLine(th.fg("success", "  All clear! No type errors."), width, chromeOpts));
			if (this.totalDiagnostics > 0) {
				lines.push(padContentLine(
					th.fg("dim", `  ${this.totalDiagnostics} warning(s)/hint(s)`),
					width, chromeOpts,
				));
			}
			lines.push(padContentLine("", width, chromeOpts));
		} else {
			let selectIdx = 0;
			for (const group of this.groups) {
				const isSelected = selectIdx === this.selectedIndex;
				const marker = group.expanded ? "▾" : "▸";
				const errCount = group.diagnostics.filter(d => d.severity === "error").length;
				const warnCount = group.diagnostics.length - errCount;
				const counts = [
					errCount > 0 ? th.fg("error", `${errCount}E`) : "",
					warnCount > 0 ? th.fg("warning", `${warnCount}W`) : "",
				].filter(Boolean).join(" ");
				const prefix = isSelected && focused ? th.fg("accent", "▶ ") : "  ";
				const fileColor = isSelected && focused ? "accent" : "text";

				lines.push(padContentLine(
					`${prefix}${marker} ${th.fg(fileColor as any, group.relPath)} ${counts}`,
					width, chromeOpts,
				));
				selectIdx++;

				if (group.expanded) {
					for (const d of group.diagnostics) {
						const isDiagSelected = selectIdx === this.selectedIndex;
						const dPrefix = isDiagSelected && focused ? th.fg("accent", "  ▶ ") : "    ";
						const loc = th.fg("dim", `${d.line}:${d.col}`);
						const sevColor = d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "dim";
						const code = th.fg(sevColor as any, d.code);

						lines.push(padContentLine(
							`${dPrefix}${loc} ${code} ${d.message}`,
							width, chromeOpts,
						));
						selectIdx++;
					}
				}
			}
			lines.push(padContentLine("", width, chromeOpts));
		}

		lines.push(...renderFooter(width, chromeOpts));

		this.cache = lines;
		return lines;
	}
}

// ── Tool Parameters ──

const LintParams = Type.Object({
	action: StringEnum(["check", "open", "close"] as const, {
		description: "check: run tsc and return results. open: show lint panel. close: hide lint panel.",
	}),
});

type LintInput = Static<typeof LintParams>;

// ── Extension ──

export default function lintPanel(pi: ExtensionAPI): void {
	let panelComponent: LintPanelComponent | null = null;
	let lspManager: LspManager | null = null;
	const PANEL_ID = "lint-panel";

	function ensureLsp(cwd: string): LspManager {
		if (!lspManager) {
			lspManager = new LspManager(cwd);
			lspManager.start().catch(() => {}); // Fire and forget — errors surface in panel
		}
		return lspManager;
	}

	pi.registerTool({
		name: "lint",
		label: "Lint",
		description:
			"Run TypeScript type checking and show results. Use 'check' to get diagnostics as text, 'open' to show a persistent floating panel, 'close' to hide it.",
		promptSnippet:
			"Run TypeScript type checking (tsc) and show/manage diagnostic results",
		promptGuidelines: [
			"Use 'check' before committing to verify no type errors",
			"Use 'open' to keep a persistent lint panel visible while working",
			"Use 'close' to dismiss the lint panel when done",
		],
		parameters: LintParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const panels = getPanels();
			const cwd = ctx.cwd;

			if (params.action === "check") {
				const tsconfig = findTsconfig(cwd);
				if (!tsconfig) {
					return {
						content: [{ type: "text" as const, text: "No tsconfig.json found in project" }],
						details: { action: "check", found: false },
					};
				}

				const result = runTsc(cwd, tsconfig);
				const groups = groupByFile(result.diagnostics, cwd);

				if (result.diagnostics.length === 0) {
					return {
						content: [{ type: "text" as const, text: `✅ No type errors (${result.duration}ms)` }],
						details: { action: "check", errors: 0, duration: result.duration },
					};
				}

				const lines: string[] = [];
				lines.push(`⚠️ ${result.diagnostics.length} type error(s) found (${result.duration}ms)\n`);
				for (const group of groups) {
					lines.push(`## ${group.relPath} (${group.diagnostics.length})`);
					for (const d of group.diagnostics) {
						lines.push(`  ${d.line}:${d.col} ${d.code} ${d.message}`);
					}
					lines.push("");
				}

				return {
					content: [{ type: "text" as const, text: lines.join("\n") }],
					details: {
						action: "check",
						errors: result.diagnostics.length,
						duration: result.duration,
						files: groups.map(g => ({ path: g.relPath, count: g.diagnostics.length })),
					},
				};
			}

			if (params.action === "open") {
				if (!panels) {
					return {
						content: [{ type: "text" as const, text: "Panel manager not available — dots-panels extension required" }],
						details: { action: "open", success: false },
					};
				}

				if (panelComponent) {
					panels.close(PANEL_ID);
					panelComponent = null;
				}

				const lsp = ensureLsp(cwd);

				panels.createPanel(PANEL_ID, (panelCtx: any) => {
					panelComponent = new LintPanelComponent({ panelCtx, cwd, lsp });
					return {
						render: (w: number) => panelComponent!.render(w),
						invalidate: () => panelComponent!.invalidate(),
						handleInput: (data: string) => panelComponent!.handleInput(data),
						dispose: () => panelComponent!.dispose(),
					};
				}, {
					anchor: "top-right",
					width: "45%",
				});

				return {
					content: [{ type: "text" as const, text: "Opened lint panel — LSP connecting..." }],
					details: { action: "open", success: true, mode: "lsp" },
				};
			}

			if (params.action === "close") {
				if (panels && panelComponent) {
					panels.close(PANEL_ID);
					panelComponent = null;
					return {
						content: [{ type: "text" as const, text: "Closed lint panel" }],
						details: { action: "close", success: true },
					};
				}
				return {
					content: [{ type: "text" as const, text: "No lint panel open" }],
					details: { action: "close", success: false },
				};
			}

			return {
				content: [{ type: "text" as const, text: `Unknown action: ${params.action}` }],
				details: { action: params.action, success: false },
			};
		},
	});

	// Register /lint command
	pi.registerCommand("lint", {
		description: "Run type check or manage lint panel (check|open|close)",
		handler: async (args, ctx) => {
			const action = (args ?? "").trim() || "check";
			if (action === "open") {
				ctx.ui.notify("Opening lint panel...", "info");
			} else if (action === "close") {
				if (panelComponent) {
					getPanels()?.close(PANEL_ID);
					panelComponent = null;
					ctx.ui.notify("Closed lint panel", "info");
				}
			} else {
				const tsconfig = findTsconfig(ctx.cwd);
				if (!tsconfig) {
					ctx.ui.notify("No tsconfig.json found", "warning");
					return;
				}
				const result = runTsc(ctx.cwd, tsconfig);
				if (result.diagnostics.length === 0) {
					ctx.ui.notify(`✅ No type errors (${result.duration}ms)`, "info");
				} else {
					ctx.ui.notify(`⚠️ ${result.diagnostics.length} error(s) (${result.duration}ms)`, "warning");
				}
			}
		},
	});

	// Cleanup on exit
	process.on("exit", () => { lspManager?.dispose(); });
}
