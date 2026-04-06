// dragon-lab.ts — Experimental provider feature opt-in manager
//
// Manages provider-level opt-in features (beta headers, experimental APIs) that
// require explicit provider registration. Loads before other dragon-* extensions
// alphabetically so features are active by the time agent_start fires.
//
// Hoard's own features don't need to gate through dragon-lab — they ship on by
// default. This is for external provider experiments: Anthropic betas, future
// Google/OpenAI opt-ins, etc.
//
// globalThis API: Symbol.for("hoard.lab")
// Settings: hoard.lab.*

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Model, Api } from "@mariozechner/pi-ai";
import { readHoardSetting } from "../lib/settings";

declare const pi: ExtensionAPI;

// ─── Public API ──────────────────────────────────────────────────────────────

export interface LabFeature {
	/** Namespaced id, e.g. "anthropic.context-management" or "openai.realtime". */
	id: string;
	/** Provider this feature belongs to ("anthropic", "google", "openai", …). */
	provider: string;
	/** Human-readable description for status display. */
	description: string;
}

export interface DragonLabAPI {
	/**
	 * Register a feature. Called by extensions at load time so dragon-lab
	 * knows to activate it on the next session_start.
	 */
	register(feature: LabFeature): void;
	/** Returns true if the feature was successfully activated this session. */
	isActive(id: string): boolean;
	/** All currently active features for the session. */
	getActive(): LabFeature[];
}

// ─── Pi Anthropic known betas ────────────────────────────────────────────────
//
// Mirror of the hardcoded betas in pi-ai/dist/providers/anthropic.js.
// We must reproduce the full string because mergeHeaders is Object.assign —
// our providerHeaders.anthropic-beta overwrites pi's base value entirely.
//
// Update this constant when pi adds new betas (check anthropic.js in pi-ai).

const PI_BASE_BETAS = [
	"claude-code-20250219",
	"fine-grained-tool-streaming-2025-05-14",
	"interleaved-thinking-2025-05-14", // always include — safe when thinking is off, required when on
];
const PI_OAUTH_BETA = "oauth-2025-04-20";

// ─── Built-in features ───────────────────────────────────────────────────────

const ANTHROPIC_CONTEXT_MANAGEMENT: LabFeature = {
	id: "anthropic.context-management",
	provider: "anthropic",
	description: "Server-side context editing: clear_tool_uses, clear_thinking, compact_20260112",
};

// ─── Global state ────────────────────────────────────────────────────────────

const LAB_KEY = Symbol.for("hoard.lab");

// Features registered by other extensions at load time.
const _pending = new Map<string, LabFeature>();
// Features activated for the current session.
const _active = new Map<string, LabFeature>();

const api: DragonLabAPI = {
	register(feature) {
		_pending.set(feature.id, feature);
	},
	isActive(id) {
		return _active.has(id);
	},
	getActive() {
		return Array.from(_active.values());
	},
};

(globalThis as any)[LAB_KEY] = api;

// ─── Session start ────────────────────────────────────────────────────────────

pi.on("session_start", async (_event, ctx) => {
	_active.clear();

	const model = ctx.model as Model<Api> | undefined;
	if (!model) return;

	// ── Anthropic context management ──────────────────────────────────────────
	//
	// Activates Anthropic's context management API (clear_tool_uses,
	// clear_thinking, compact_20260112) by injecting the beta header.
	//
	// Note: registerProvider replaces providerRequestConfigs entirely, so we
	// must reproduce pi's full beta string. API key users who configured their
	// key only via settings.json (not /login) will have their key wiped from
	// providerRequestConfigs — authStorage-based auth (OAuth, /login API key)
	// is unaffected. Document this limitation and revisit if it comes up.

	if (model.provider === "anthropic") {
		const enabled = readHoardSetting<boolean>("lab.anthropic.contextManagement", true);
		if (enabled !== false) {
			const isOAuth = ctx.modelRegistry.isUsingOAuth(model);

			const betas = [
				...PI_BASE_BETAS,
				isOAuth ? PI_OAUTH_BETA : null,
				"context-management-2025-06-27",
			]
				.filter(Boolean)
				.join(",");

			pi.registerProvider("anthropic", { headers: { "anthropic-beta": betas } });
			_active.set(ANTHROPIC_CONTEXT_MANAGEMENT.id, ANTHROPIC_CONTEXT_MANAGEMENT);
		}
	}

	// ── External features ─────────────────────────────────────────────────────
	// Extensions can call lab.register(feature) at load time. Dragon-lab marks
	// them active here if they match the current provider. Extensions handle
	// their own provider registration; this just tracks activation state.
	for (const [id, feature] of _pending) {
		if (!_active.has(id) && feature.provider === model.provider) {
			_active.set(id, feature);
		}
	}
});
