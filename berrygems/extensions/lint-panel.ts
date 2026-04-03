/**
 * Lint Panel — Floating diagnostics panel via dots-panels.
 *
 * Runs tsc and shows type errors in a scrollable floating panel.
 * Auto-refreshes on file changes. Groups errors by file with
 * expandable details.
 *
 * A three-inch dog wrote this inside a dragon's stomach.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text, matchesKey, Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { execSync } from "node:child_process";
import { resolve, relative, dirname } from "node:path";
import { existsSync } from "node:fs";
import {
	renderHeader, renderFooter, padContentLine,
	type PanelSkin,
} from "../lib/panel-chrome.ts";

// ── Panel Manager Access ──

const PANELS_KEY = Symbol.for("dot.panels");
function getPanels(): any {
	return (globalThis as any)[PANELS_KEY];
}

// ── Types ──

interface Diagnostic {
	file: string;
	line: number;
	col: number;
	code: string;
	message: string;
}

interface FileGroup {
	file: string;
	relPath: string;
	diagnostics: Diagnostic[];
	expanded: boolean;
}

// ── Diagnostic Parser ──

function parseTscOutput(output: string, cwd: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		// Format: file(line,col): error TSXXXX: message
		const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
		if (match) {
			diagnostics.push({
				file: resolve(cwd, match[1]!),
				line: parseInt(match[2]!, 10),
				col: parseInt(match[3]!, 10),
				code: match[4]!,
				message: match[5]!,
			});
		}
	}

	return diagnostics;
}

function groupByFile(diagnostics: Diagnostic[], cwd: string): FileGroup[] {
	const groups = new Map<string, FileGroup>();

	for (const d of diagnostics) {
		let group = groups.get(d.file);
		if (!group) {
			group = {
				file: d.file,
				relPath: relative(cwd, d.file),
				diagnostics: [],
				expanded: false,
			};
			groups.set(d.file, group);
		}
		group.diagnostics.push(d);
	}

	return [...groups.values()].sort((a, b) => a.relPath.localeCompare(b.relPath));
}

// ── Lint Runner ──

function findTsconfig(cwd: string): string | null {
	// Check common locations
	const candidates = [
		resolve(cwd, "tsconfig.json"),
		resolve(cwd, "berrygems/tsconfig.json"),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}

function runTsc(cwd: string, tsconfigPath: string): { diagnostics: Diagnostic[]; duration: number } {
	const start = Date.now();
	let output = "";
	try {
		execSync(`tsc --project ${tsconfigPath}`, {
			cwd,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30_000,
		});
	} catch (err: any) {
		// tsc exits non-zero when there are errors — that's expected
		output = (err.stdout ?? "") + (err.stderr ?? "");
	}
	const duration = Date.now() - start;
	const diagnostics = parseTscOutput(output, cwd);
	return { diagnostics, duration };
}

// ── Panel Component ──

interface LintPanelOptions {
	panelCtx: any; // PanelContext
	cwd: string;
}

class LintPanelComponent {
	private panelCtx: any;
	private cwd: string;
	private theme!: Theme;
	private tui!: TUI;
	private groups: FileGroup[] = [];
	private totalErrors = 0;
	private lastRun: Date | null = null;
	private duration = 0;
	private running = false;
	private selectedIndex = 0;
	private scrollOffset = 0;
	private cache: string[] | null = null;

	constructor(options: LintPanelOptions) {
		this.panelCtx = options.panelCtx;
		this.cwd = options.cwd;
		this.theme = options.panelCtx.theme;
		this.tui = options.panelCtx.tui;

		// Run initial check
		this.refresh();
	}

	refresh(): void {
		const tsconfig = findTsconfig(this.cwd);
		if (!tsconfig) {
			this.groups = [];
			this.totalErrors = 0;
			this.running = false;
			this.cache = null;
			return;
		}

		this.running = true;
		this.cache = null;
		this.tui?.requestRender();

		// Run async to not block rendering
		setTimeout(() => {
			const result = runTsc(this.cwd, tsconfig);
			this.groups = groupByFile(result.diagnostics, this.cwd);
			this.totalErrors = result.diagnostics.length;
			this.duration = result.duration;
			this.lastRun = new Date();
			this.running = false;

			// Auto-expand first file if few groups
			if (this.groups.length <= 3) {
				for (const g of this.groups) g.expanded = true;
			}

			this.cache = null;
			this.tui?.requestRender();
		}, 0);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "r")) {
			this.refresh();
			return;
		}
		if (matchesKey(data, "j") || matchesKey(data, Key.Down)) {
			this.selectedIndex = Math.min(this.selectedIndex + 1, this.getSelectableCount() - 1);
			this.cache = null;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, "k") || matchesKey(data, Key.Up)) {
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
			this.cache = null;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, Key.Enter) || matchesKey(data, " " as any)) {
			this.toggleExpand();
			return;
		}
	}

	private getSelectableCount(): number {
		let count = 0;
		for (const g of this.groups) {
			count++; // file header
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

	render(width: number): string[] {
		if (this.cache) return this.cache;

		const th = this.theme;
		const skin: PanelSkin = this.panelCtx.skin();
		const focused = this.panelCtx.isFocused();

		const chromeOpts = {
			theme: th,
			skin,
			focused,
			title: this.running
				? "🔍 Checking..."
				: this.totalErrors === 0
					? "✅ Lint — No Errors"
					: `⚠️ Lint — ${this.totalErrors} error${this.totalErrors === 1 ? "" : "s"}`,
			footerHint: focused ? "r refresh · j/k nav · ⏎ expand" : undefined,
			scrollInfo: this.lastRun ? `${this.duration}ms` : undefined,
		};

		const lines: string[] = [];

		// Header
		lines.push(...renderHeader(width, chromeOpts));

		if (this.running) {
			lines.push(padContentLine(th.fg("dim", "  Running tsc..."), width, chromeOpts));
			lines.push(padContentLine("", width, chromeOpts));
		} else if (this.totalErrors === 0 && this.lastRun) {
			lines.push(padContentLine(th.fg("success", "  All clear! No type errors found."), width, chromeOpts));
			lines.push(padContentLine("", width, chromeOpts));
		} else if (!this.lastRun) {
			lines.push(padContentLine(th.fg("dim", "  No tsconfig.json found"), width, chromeOpts));
			lines.push(padContentLine("", width, chromeOpts));
		} else {
			// Render file groups
			let selectIdx = 0;
			for (const group of this.groups) {
				const isSelected = selectIdx === this.selectedIndex;
				const marker = group.expanded ? "▾" : "▸";
				const count = th.fg("dim", `(${group.diagnostics.length})`);
				const prefix = isSelected && focused ? th.fg("accent", "▶ ") : "  ";
				const fileColor = isSelected && focused ? "accent" : "text";

				lines.push(padContentLine(
					`${prefix}${marker} ${th.fg(fileColor, group.relPath)} ${count}`,
					width, chromeOpts,
				));
				selectIdx++;

				if (group.expanded) {
					for (const d of group.diagnostics) {
						const isDiagSelected = selectIdx === this.selectedIndex;
						const dPrefix = isDiagSelected && focused ? th.fg("accent", "  ▶ ") : "    ";
						const loc = th.fg("dim", `${d.line}:${d.col}`);
						const code = th.fg("warning", d.code);
						const msg = d.message;

						lines.push(padContentLine(
							`${dPrefix}${loc} ${code} ${msg}`,
							width, chromeOpts,
						));
						selectIdx++;
					}
				}
			}
			lines.push(padContentLine("", width, chromeOpts));
		}

		// Footer
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
	const PANEL_ID = "lint-panel";

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

				// Format errors grouped by file
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
						files: groups.map(g => ({
							path: g.relPath,
							count: g.diagnostics.length,
						})),
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

				// Close existing if open
				if (panelComponent) {
					panels.close(PANEL_ID);
					panelComponent = null;
				}

				const panelResult = panels.createPanel(PANEL_ID, (panelCtx: any) => {
					panelComponent = new LintPanelComponent({
						panelCtx,
						cwd,
					});
					return {
						render: (w: number) => panelComponent!.render(w),
						invalidate: () => panelComponent!.invalidate(),
						handleInput: (data: string) => panelComponent!.handleInput(data),
					};
				}, {
					anchor: "top-right",
					width: "45%",
				});

				return {
					content: [{ type: "text" as const, text: "Opened lint panel — running type check..." }],
					details: { action: "open", success: true },
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
			if (action === "open" || action === "close") {
				// Trigger the tool
				ctx.ui.notify(`Lint: ${action}`, "info");
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
}
