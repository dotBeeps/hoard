/**
 * ally-status-tool.ts — Running ally process registry + ally_status diagnostic tool.
 *
 * Tracks spawned ally processes with rolling log capture.
 * Provides the `ally_status` tool for diagnosing stuck/slow allies.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ── Running Ally Registry ────────────────────────────────────────────────────

export interface RunningAlly {
	id: string;
	defName: string;
	startMs: number;
	stderrLines: string[];
	stoneMessages: Array<{ time: number; content: string; type: string }>;
}

const runningAllies = new Map<string, RunningAlly>();

export function registerAlly(id: string, defName: string): void {
	runningAllies.set(id, { id, defName, startMs: Date.now(), stderrLines: [], stoneMessages: [] });
}

export function appendAllyLine(id: string, line: string): void {
	const entry = runningAllies.get(id);
	if (!entry) return;
	entry.stderrLines.push(line);
	if (entry.stderrLines.length > 200) entry.stderrLines.shift(); // rolling window
}

/** Record a stone message from an ally (matched by defName) */
export function appendAllyStoneMessage(defName: string, content: string, type: string): void {
	for (const entry of runningAllies.values()) {
		if (entry.defName === defName || defName.includes(entry.defName)) {
			entry.stoneMessages.push({ time: Date.now(), content, type });
			if (entry.stoneMessages.length > 50) entry.stoneMessages.shift();
			return;
		}
	}
}

export function deregisterAlly(id: string): void {
	runningAllies.delete(id);
}

export function getRunningAllies(): Map<string, RunningAlly> {
	return runningAllies;
}

// ── ally_status Tool Registration ────────────────────────────────────────────

/**
 * Register the ally_status diagnostic tool.
 * Only available in the primary session or guild-master — not to regular allies.
 */
export function registerAllyStatusTool(pi: ExtensionAPI): void {
	if (process.env["HOARD_GUARD_MODE"] === "ally") return;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(pi.registerTool as any)({
		name: "ally_status",
		description: "Check the current status and recent log output of one or all running allies. Use to diagnose stuck or slow allies.",
		parameters: Type.Object({
			ally: Type.Optional(Type.String({ description: "Ally defName to check (e.g. 'wise-griffin-researcher'). Omit to list all running allies." })),
			lines: Type.Optional(Type.Number({ description: "Number of recent log lines to return (default: 20)" })),
		}),
		execute: async (_id: string, params: { ally?: string; lines?: number }) => {
			const lineCount = params.lines ?? 20;

			if (runningAllies.size === 0) {
				return { content: [{ type: "text" as const, text: "No allies currently running." }] };
			}

			const entries = params.ally
				? [...runningAllies.values()].filter((a) => a.defName.includes(params.ally!))
				: [...runningAllies.values()];

			if (entries.length === 0) {
				return { content: [{ type: "text" as const, text: `No running ally matching "${params.ally}". Running: ${[...runningAllies.values()].map((a) => a.defName).join(", ")}` }] };
			}

			const sections = entries.map((entry) => {
				const elapsed = Math.round((Date.now() - entry.startMs) / 1000);
				const recent = entry.stderrLines.slice(-lineCount).join("\n");
				const stoneSection = entry.stoneMessages.length > 0
					? "\n\n**Stone messages:**\n" + entry.stoneMessages.slice(-5).map((m) => {
						const ago = Math.round((Date.now() - m.time) / 1000);
						return `  [${ago}s ago] (${m.type}) ${m.content}`;
					}).join("\n")
					: "";
				return `**${entry.defName}** — ${elapsed}s elapsed\n${recent || "(no output yet)"}${stoneSection}`.trim();
			});

			return { content: [{ type: "text" as const, text: sections.join("\n\n---\n\n") }] };
		},
	});
}
