/**
 * hoard-sending-stone — Cross-agent communication bus for pi sessions.
 *
 * Starts a local HTTP/SSE server in the primary session, writes connection info
 * to ~/.pi/hoard-sending-stone.json so subagent sessions can discover it.
 * Exposes stoneAPI on globalThis for other extensions to subscribe to messages.
 *
 * Reinitializes on /reload — stops old server, starts fresh.
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { startServer, stopServer } from "./server.js";
import { sendToStone } from "./client.js";
import type { StoneAPI, StoneMessage } from "./types.js";
import { STONE_KEY } from "./types.js";

const JSON_PATH = path.join(os.homedir(), ".pi", "hoard-sending-stone.json");
const INTERNALS_KEY = Symbol.for("hoard.stone.internals");

interface StoneInternals {
	port: number | null;
	sseReq: http.ClientRequest | null;
	handlers: Set<(msg: StoneMessage) => void>;
}

function getInternals(): StoneInternals {
	let internals = (globalThis as any)[INTERNALS_KEY] as StoneInternals | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
	if (!internals) {
		internals = { port: null, sseReq: null, handlers: new Set() };
		(globalThis as any)[INTERNALS_KEY] = internals; // eslint-disable-line @typescript-eslint/no-explicit-any
	}
	return internals;
}

export default function (pi: ExtensionAPI, _ctx: ExtensionContext): void {
	// Ally sessions get a client-only stone API (send only, no server)
	if (process.env["HOARD_GUARD_MODE"] === "ally") {
		const allyStoneAPI: StoneAPI = {
			onMessage() { return () => {}; },
			async send(msg) { await sendToStone(msg); },
			port() { return Number(process.env["HOARD_STONE_PORT"]) || null; },
		};
		(globalThis as any)[STONE_KEY] = allyStoneAPI; // eslint-disable-line @typescript-eslint/no-explicit-any

		// Register stone_send tool for allies too
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(pi.registerTool as any)({
			name: "stone_send",
			description: "Send a message via the sending stone to the room, a specific agent, or dot. Use to communicate with running allies, ask questions, or broadcast updates.",
			parameters: Type.Object({
				to: Type.Optional(Type.String({ description: "Who to address: \"primary-agent\", \"user\", \"guild-master\", \"session-room\", or an ally defName. Default: \"session-room\"" })),
				message: Type.String({ description: "The message to send" }),
				type: Type.Optional(Type.String({ description: "Message type: \"question\", \"status\", \"result\", \"progress\". Default: \"status\"" })),
			}),
			execute: async (_id: string, params: { to?: string; message: string; type?: string }) => {
				const addressing = params.to ?? "session-room";
				try {
					await allyStoneAPI.send({
						from: process.env["HOARD_ALLY_DEFNAME"] ?? "ally",
						type: (params.type ?? "status") as "status",
						addressing,
						content: params.message,
					});
					return { content: [{ type: "text" as const, text: `\u2709\ufe0f Sent to ${addressing}: ${params.message}` }] };
				} catch (err) {
					return { content: [{ type: "text" as const, text: `Failed to send: ${(err as Error).message}` }] };
				}
			},
		});

		return;
	}

	const internals = getInternals();

	// ── Settings ──
	const readSetting = <T>(key: string, fallback: T): T => {
		try {
			const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
			if (fs.existsSync(settingsPath)) {
				const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
				const keys = key.split(".");
				let val: unknown = settings;
				for (const k of keys) val = (val as Record<string, unknown>)?.[k];
				return (val as T) ?? fallback;
			}
		} catch {}
		return fallback;
	};
	const primaryDisplayName = readSetting<string>("hoard.contributor.name", "Agent");

	// ── Custom message renderer for stone messages ──

	// Well-known address -> display name mapping
	const ADDRESS_NAMES: Record<string, string> = {
		"primary-agent": primaryDisplayName,
		"user": "dot",
		"guild-master": "Maren",
		"session-room": "room",
	};

	// Name registry for allies (populated by hoard-allies via globalThis)
	const NAME_REGISTRY_KEY = Symbol.for("hoard.stone.names");
	function resolveDisplayName(id: string): string {
		if (ADDRESS_NAMES[id]) return ADDRESS_NAMES[id];
		// Check ally name registry
		const registry = (globalThis as any)[NAME_REGISTRY_KEY] as Record<string, string> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
		if (registry?.[id]) return registry[id];
		// Fall back to title-casing the ID
		return id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	}

	// Base hues per tier (HSL degrees)
	const TIER_HUES: Record<string, number> = {
		kobold: 120, griffin: 220, dragon: 280,
		"guild-master": 35, "primary-agent": 45, user: 185,
	};

	function hashName(name: string): number {
		let h = 0;
		for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
		return h;
	}

	function hslToRgb(h: number, s: number, l: number): [number, number, number] {
		h = ((h % 360) + 360) % 360;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0, g = 0, b = 0;
		if (h < 60)       { r = c; g = x; }
		else if (h < 120) { r = x; g = c; }
		else if (h < 180) { g = c; b = x; }
		else if (h < 240) { g = x; b = c; }
		else if (h < 300) { r = x; b = c; }
		else              { r = c; b = x; }
		return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
	}

	function nameColor(name: string, fromId: string): string {
		const parts = fromId.split("-");
		const tier = parts.find((p) => TIER_HUES[p]) ?? fromId;
		const baseHue = TIER_HUES[tier] ?? 200;
		const offset = (hashName(name) % 61) - 30;
		const hue = baseHue + offset;
		const [r, g, b] = hslToRgb(hue, 0.7, 0.6);
		return `\x1b[38;2;${r};${g};${b}m`;
	}

	const RST = "\x1b[0m";
	const DIM = "\x1b[2m";
	const MAX_LINES = readSetting<number>("hoard.stone.maxLines", 8);

	interface StoneDetails { from: string; to: string; displayName?: string; content: string; timestamp?: string }
	pi.registerMessageRenderer<StoneDetails>("stone-message", (message, _options, _theme) => {
		const d = message.details;
		const fallback = typeof message.content === "string" ? message.content : "";
		if (!d) return new Text(fallback, 0, 0);

		const senderName = d.displayName ?? resolveDisplayName(d.from);
		const receiverName = resolveDisplayName(d.to);
		const ts = d.timestamp ?? new Date().toLocaleTimeString();
		const senderClr = nameColor(senderName, d.from);
		const receiverClr = nameColor(receiverName, d.to);

		// Terminal-aware word wrapping
		const cols = process.stdout.columns || 80;
		const boxW = Math.min(cols, 100); // cap at 100 so it doesn't stretch on ultrawide
		const innerW = boxW - 4; // "│ " + content + " │"

		function wordWrap(line: string): string[] {
			if (line.length <= innerW) return [line];
			const wrapped: string[] = [];
			let remaining = line;
			while (remaining.length > innerW) {
				let breakAt = remaining.lastIndexOf(" ", innerW);
				if (breakAt <= 0) breakAt = innerW;
				wrapped.push(remaining.slice(0, breakAt));
				remaining = remaining.slice(breakAt + (remaining[breakAt] === " " ? 1 : 0));
			}
			if (remaining) wrapped.push(remaining);
			return wrapped;
		}

		// Truncate then wrap
		const bodyLines = d.content.split("\n");
		const truncated = bodyLines.length > MAX_LINES;
		const visibleLines = truncated ? bodyLines.slice(0, MAX_LINES) : bodyLines;
		const wrappedLines = visibleLines.flatMap(wordWrap);

		// Header
		const header = `${senderClr}${senderName}${RST} ${DIM}→${RST} ${receiverClr}${receiverName}${RST} ${DIM}(${ts})${RST}`;
		const headerPlain = `╭── 💬 ${senderName} → ${receiverName} (${ts}) `;
		const headerW = headerPlain.length;
		const topFill = "─".repeat(Math.max(0, boxW - headerW - 1));
		const topBar = `${DIM}╭── 💬 ${RST}${header} ${DIM}${topFill}╮${RST}`;

		// Content lines — padded to innerW
		const msgBody = wrappedLines.map((l) => {
			const pad = " ".repeat(Math.max(0, innerW - l.length));
			return `${DIM}│${RST} ${l}${pad} ${DIM}│${RST}`;
		}).join("\n");

		// Overflow
		const overflowLine = truncated
			? (() => {
				const text = `... ${bodyLines.length - MAX_LINES} more lines`;
				const pad = " ".repeat(Math.max(0, innerW - text.length));
				return `\n${DIM}│ ${text}${pad} │${RST}`;
			})()
			: "";

		// Bottom
		const botBar = `${DIM}╰${"─".repeat(Math.max(0, boxW - 2))}╯${RST}`;

		return new Text(`${topBar}\n${msgBody}${overflowLine}\n${botBar}`, 0, 0);
	});

	// ── Cleanup from previous load (handles /reload) ──
	if (internals.sseReq) {
		internals.sseReq.destroy();
		internals.sseReq = null;
	}
	if (internals.port != null) {
		stopServer();
		try { if (fs.existsSync(JSON_PATH)) fs.unlinkSync(JSON_PATH); } catch {}
		internals.port = null;
	}
	internals.handlers.clear();

	// ── SSE stream ──

	function openSSEStream(port: number): void {
		try {
			const req = http.get(
				{ hostname: "127.0.0.1", port, path: "/stream", headers: { Accept: "text/event-stream" } },
				(res) => {
					let buf = "";
					res.on("data", (chunk: Buffer) => {
						buf += chunk.toString();
						const lines = buf.split("\n");
						buf = lines.pop() ?? "";
						for (const line of lines) {
							if (!line.startsWith("data:")) continue;
							const raw = line.slice(5).trim();
							if (!raw) continue;
							try {
								const msg = JSON.parse(raw) as StoneMessage;
								for (const h of internals.handlers) h(msg);
							} catch { /* ignore malformed payloads */ }
						}
					});
					res.on("error", () => {});
				},
			);
			req.on("error", () => {});
			internals.sseReq = req;
		} catch { /* ignore */ }
	}

	// ── Stone API ──

	function postToSelf(msg: Partial<StoneMessage> & { content: string; from: string }): Promise<void> {
		const port = internals.port;
		if (port == null) return Promise.resolve();
		const body = JSON.stringify(msg);
		return new Promise<void>((resolve) => {
			const req = http.request(
				{ hostname: "127.0.0.1", port, path: "/message", method: "POST",
				  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
				(res) => { res.resume(); resolve(); },
			);
			req.on("error", () => resolve());
			req.write(body);
			req.end();
		});
	}

	const stoneAPI: StoneAPI = {
		onMessage(handler: (msg: StoneMessage) => void): () => void {
			internals.handlers.add(handler);
			return () => { internals.handlers.delete(handler); };
		},
		async send(msg) { await postToSelf(msg); },
		port() { return internals.port; },
	};

	(globalThis as any)[STONE_KEY] = stoneAPI; // eslint-disable-line @typescript-eslint/no-explicit-any

	// ── stone_send tool ──

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(pi.registerTool as any)({
		name: "stone_send",
		description: "Send a message via the sending stone to the room, a specific agent, or dot. Use to communicate with running allies, ask questions, or broadcast updates.",
		parameters: Type.Object({
			to: Type.Optional(Type.String({ description: "Who to address: \"primary-agent\", \"user\", \"guild-master\", \"session-room\", or an ally defName. Default: \"session-room\"" })),
			message: Type.String({ description: "The message to send" }),
			type: Type.Optional(Type.String({ description: "Message type: \"question\", \"status\", \"result\", \"progress\". Default: \"status\"" })),
		}),
		execute: async (_id: string, params: { to?: string; message: string; type?: string }) => {
			const addressing = params.to ?? "session-room";
			const msgType = params.type ?? "status";
			try {
				await stoneAPI.send({
					from: "primary-agent",
					displayName: primaryDisplayName,
					type: msgType as "status",
					addressing,
					content: params.message,
				});
				return { content: [{ type: "text" as const, text: `✉️ Sent to ${addressing}: ${params.message}` }] };
			} catch (err) {
				return { content: [{ type: "text" as const, text: `Failed to send: ${(err as Error).message}` }] };
			}
		},
	});

	// ── Start server immediately (works on /reload too) ──

	(async () => {
		try {
			const port = await startServer();
			internals.port = port;
			fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
			fs.writeFileSync(JSON_PATH, JSON.stringify({ port, pid: process.pid }), "utf8");
			openSSEStream(port);
		} catch (err) {
			console.warn(`[sending-stone] server start failed: ${String(err)}`);
		}
	})();

	pi.on("session_shutdown", async () => {
		try {
			if (internals.sseReq) { internals.sseReq.destroy(); internals.sseReq = null; }
			stopServer();
			internals.port = null;
			if (fs.existsSync(JSON_PATH)) fs.unlinkSync(JSON_PATH);
		} catch {}
	});
}
