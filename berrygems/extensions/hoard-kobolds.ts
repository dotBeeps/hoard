import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readHoardSetting } from "../lib/settings.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * hoard-kobolds — Subagent token governance for the hoard.
 *
 * Provides the kobold/griffin/dragon taxonomy for subagent dispatch:
 *   <thinking> <model> = <silly|clever|wise|elder> <kobold|griffin|dragon>
 *
 * Agent definitions are dynamically generated from settings on session start.
 * Configure via hoard.kobolds.* in settings.json.
 */

// ── Types ──

interface TierConfig {
	name: string;
	adjective: string;
	noun: string;
	description: string;
	tools: string;
	prompt: string;
}

// ── Defaults ──

const DEFAULT_MODELS: Record<string, string[]> = {
	kobold: ["anthropic/claude-haiku-4-5", "github-copilot/claude-haiku-4-5", "google/gemini-2.0-flash"],
	griffin: ["anthropic/claude-sonnet-4-6", "github-copilot/claude-sonnet-4-6", "google/gemini-2.5-pro"],
	dragon: ["anthropic/claude-opus-4-6", "github-copilot/claude-opus-4-6"],
};

const DEFAULT_THINKING: Record<string, string> = {
	silly: "none",
	clever: "low",
	wise: "medium",
	elder: "high",
};

const DEFAULT_MAX_PARALLEL = 4;
const DEFAULT_CONFIRM_ABOVE = "griffin"; // noun tier — confirm before dispatching this tier or above
const DEFAULT_ANNOUNCE = true;

// ── Agent Templates ──

const KOBOLD_TOOLS = "read, grep, find, ls, bash";
const GRIFFIN_TOOLS = "read, grep, find, ls, bash, write, edit";
const DRAGON_TOOLS = "read, grep, find, ls, bash, write, edit";

const TIERS: TierConfig[] = [
	{
		name: "silly-kobold", adjective: "silly", noun: "kobold",
		description: "Cheapest option. File discovery, listing, structure mapping, quick checks. No reasoning needed.",
		tools: KOBOLD_TOOLS,
		prompt: "You are a kobold \u2014 small, fast, cheap. Do exactly what you're told, nothing more.\nNo analysis. No opinions. No summaries unless asked. Just fetch the information and return it.\nKeep responses short. Cite file paths. Don't explain things you weren't asked to explain.",
	},
	{
		name: "clever-kobold", adjective: "clever", noun: "kobold",
		description: "Quick reviews, frontmatter validation, simple code checks. Light reasoning, cheap model.",
		tools: KOBOLD_TOOLS + ", write",
		prompt: "You are a clever kobold \u2014 small but sharp. Reason a little, stay focused and frugal.\nGood for: simple code review, validation, config checks, linting output interpretation.\nKeep it concise. Flag issues with file:line references. Don't write essays.",
	},
	{
		name: "wise-kobold", adjective: "wise", noun: "kobold",
		description: "Analysis tasks that need real reasoning but not a big model. Pattern matching, comparisons, moderate code review.",
		tools: KOBOLD_TOOLS + ", write",
		prompt: "You are a wise kobold \u2014 the most you can squeeze from a small model. Reason carefully.\nGood for: code review with explanations, API comparison, documentation quality assessment.\nBe thorough but efficient. Cite sources. Prioritize findings by severity.",
	},
	{
		name: "silly-griffin", adjective: "silly", noun: "griffin",
		description: "Mid-tier model for tasks that need smarts but not deep reasoning. Code generation, straightforward implementations.",
		tools: GRIFFIN_TOOLS,
		prompt: "You are a griffin \u2014 capable and reliable. No need to overthink this one, just execute well.\nGood for: code generation, file migration, straightforward refactoring, writing docs.\nWrite clean code. Follow project conventions. Don't over-engineer.",
	},
	{
		name: "clever-griffin", adjective: "clever", noun: "griffin",
		description: "Good default for tasks needing both capability and some reasoning. Reviews, analysis, moderate complexity code.",
		tools: GRIFFIN_TOOLS,
		prompt: "You are a clever griffin \u2014 strong model, light thinking. The workhorse tier.\nGood for: code review with context, feature implementation, debugging, skill/doc writing.\nBe thorough. Cite file:line for findings. Follow project AGENTS.md conventions.",
	},
	{
		name: "wise-griffin", adjective: "wise", noun: "griffin",
		description: "Deep analysis, architecture review, complex code review. Use when the task genuinely needs careful reasoning.",
		tools: GRIFFIN_TOOLS,
		prompt: "You are a wise griffin \u2014 this is an expensive dispatch. Make it count.\nGood for: architecture review, spec alignment, ethics compliance, complex refactoring.\nBe thorough and specific. Cite file:line. Prioritize by severity (critical/warning/suggestion).",
	},
	{
		name: "elder-griffin", adjective: "elder", noun: "griffin",
		description: "Maximum reasoning on a strong model. Deep architecture, complex debugging, spec writing. Expensive.",
		tools: GRIFFIN_TOOLS,
		prompt: "You are an elder griffin \u2014 the most expensive subagent short of a dragon.\nGood for: complex architecture decisions, spec writing, deep security audit.\nBe exceptionally thorough. Think carefully before acting. Document your reasoning.",
	},
	{
		name: "elder-dragon", adjective: "elder", noun: "dragon",
		description: "Maximum capability. Only for project-shaping decisions. Architecture, ethics, major specs. VERY expensive.",
		tools: DRAGON_TOOLS,
		prompt: "You are an elder dragon \u2014 the most powerful agent in the hoard. Summoned for lasting consequences.\nGood for: foundational architecture, ethics contract review, major spec authoring.\nThink deeply. Consider second-order effects. Document reasoning extensively.\nThis is an expensive dispatch. Honor the trust placed in you.",
	},
];

// ── Settings Readers ──

function getModels(): Record<string, string[]> {
	const custom = readHoardSetting<Record<string, string | string[]>>("kobolds.models", {});
	const result: Record<string, string[]> = { ...DEFAULT_MODELS };
	for (const [tier, models] of Object.entries(custom)) {
		result[tier] = Array.isArray(models) ? models : [models];
	}
	return result;
}

function getThinking(): Record<string, string> {
	return { ...DEFAULT_THINKING, ...readHoardSetting<Record<string, string>>("kobolds.thinking", {}) };
}

function getMaxParallel(): number {
	return readHoardSetting<number>("kobolds.maxParallel", DEFAULT_MAX_PARALLEL);
}

function getConfirmAbove(): string {
	return readHoardSetting<string>("kobolds.confirmAbove", DEFAULT_CONFIRM_ABOVE);
}

function getAnnounce(): boolean {
	return readHoardSetting<boolean>("kobolds.announceDispatch", DEFAULT_ANNOUNCE);
}

// ── Agent Def Generation ──

function resolveModel(noun: string): string {
	const models = getModels();
	const candidates = models[noun] ?? DEFAULT_MODELS[noun] ?? ["anthropic/claude-haiku-4-5"];
	// Return first candidate — runtime fallback would need provider availability checking
	return candidates[0]!;
}

function generateAgentDef(tier: TierConfig): string {
	const model = resolveModel(tier.noun);
	const thinking = getThinking()[tier.adjective] ?? "none";

	return `---
name: ${tier.name}
description: ${tier.description}
tools: ${tier.tools}
model: ${model}
thinking: ${thinking}
output: false
---

${tier.prompt}
`;
}

function writeAgentDefs(cwd: string): void {
	const agentsDir = join(cwd, ".pi", "agents");
	mkdirSync(agentsDir, { recursive: true });

	for (const tier of TIERS) {
		const path = join(agentsDir, `${tier.name}.md`);
		writeFileSync(path, generateAgentDef(tier));
	}
}

// ── Display ──

function buildTaxonomyDisplay(): string {
	const models = getModels();
	const thinking = getThinking();
	const maxP = getMaxParallel();
	const confirm = getConfirmAbove();

	const rows = TIERS.map((t) => {
		const modelList = (models[t.noun] ?? [resolveModel(t.noun)]).join(", ");
		const think = thinking[t.adjective] ?? "none";
		const cost = t.noun === "dragon" ? "$$$$$" : t.noun === "griffin" ? (t.adjective === "elder" ? "$$$$" : "$$$") : (t.adjective === "wise" ? "$$" : "$");
		return `| ${t.name} | ${think} | ${modelList} | ${cost} | ${t.description} |`;
	}).join("\n");

	return `## Hoard Kobolds — Subagent Taxonomy

| Agent | Thinking | Model(s) | Cost | Use Case |
|-------|----------|----------|------|----------|
${rows}

### Current Config
- **Max parallel:** ${maxP}
- **Confirm above:** ${confirm}
- **Announce dispatch:** ${getAnnounce()}

### The Rule
> **Default to kobold. Escalate only when the task genuinely needs more.**

### Quick Settings
\`\`\`json
"hoard": {
  "kobolds": {
    "models": {
      "kobold": ["anthropic/claude-haiku-4-5", "google/gemini-2.0-flash"],
      "griffin": ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro"],
      "dragon": ["anthropic/claude-opus-4"]
    },
    "thinking": { "silly": "none", "clever": "low", "wise": "medium", "elder": "high" },
    "maxParallel": 4,
    "confirmAbove": "griffin",
    "announceDispatch": true
  }
}
\`\`\`
`;
}

function buildSystemPrompt(): string {
	const maxP = getMaxParallel();
	const confirm = getConfirmAbove();
	const nounOrder = ["kobold", "griffin", "dragon"];
	const confirmIdx = nounOrder.indexOf(confirm);
	const confirmNote = confirmIdx >= 0
		? `- **Dispatching ${confirm}-tier or above requires user confirmation** (confirmAbove: "${confirm}").\n`
		: "";

	return `## Subagent Dispatch — Hoard Kobolds

You have a kobold/griffin/dragon taxonomy for subagent dispatch. Agent definitions are in .pi/agents/.

The matrix: <silly|clever|wise|elder> <kobold|griffin|dragon>
- Adjective = thinking: silly (none) → clever (low) → wise (medium) → elder (high)
- Noun = model: kobold (haiku, $) → griffin (sonnet, $$$) → dragon (opus, $$$$$)

### WHEN TO DISPATCH

Parallelize when a task has **independent subtasks that can run simultaneously**:
- Reviewing multiple files/packages/components → one agent per component
- Checking different quality dimensions → one agent per dimension
- Scanning + analyzing → kobold scouts first, then targeted reviews on findings
- Any task where you'd otherwise read 5+ files sequentially before synthesizing

Do NOT dispatch when:
- The task is simple enough to do yourself in a few tool calls
- Subtasks depend on each other's output (use chains instead of parallel)
- You'd be sending 1 agent to do 1 small thing (just do it yourself)

### HOW TO ASSIGN TIERS

1. **Can a kobold do it?** File scanning, listing, grep, structure mapping, frontmatter checks, simple validation → silly-kobold or clever-kobold
2. **Does it need reasoning about code?** Code review, API comparison, pattern analysis → wise-kobold (try haiku first — it's smarter than you think)
3. **Does it need to WRITE code or generate content?** → silly-griffin minimum. Complex generation → clever-griffin
4. **Does it need deep analysis of interconnected systems?** Architecture review, spec alignment, ethics compliance → wise-griffin
5. **Is this a project-shaping decision?** → elder-dragon. Must be rare and justified.

### RULES

- **Default: kobold.** Escalate only when the task proves it needs more.
- **Max parallel: ${maxP}.** Hard cap from settings.
- **Prefer more kobolds over fewer griffins** for scanning/review work.
- **Use chains** (kobold scout → griffin reviewer) when you need escalation on findings.
- **Token budget is finite.** This is an ethical obligation per ETHICS.md §3.7.
${confirmNote}- **When in doubt, read the hoard-kobolds skill** for detailed dispatch patterns.`;
}

export default function hoardKobolds(pi: ExtensionAPI) {
	// Regenerate agent defs from settings on session start
	pi.on("session_start", async (_event, ctx) => {
		try {
			writeAgentDefs(ctx.cwd);
		} catch {
			// Non-fatal — agent defs may already exist from a previous session
		}
	});

	// Inject taxonomy awareness into system prompt (re-reads settings each time)
	// Skip for subagents — they don't dispatch further agents, no need to burn tokens
	pi.on("before_agent_start", async (_event, ctx) => {
		if (!ctx.hasUI) {
			// Subagent — strip the global APPEND_SYSTEM.md persona prompt to save tokens
			const stripAppend = readHoardSetting<boolean>("kobolds.stripAppendForSubagents", true);
			if (stripAppend) {
				const currentPrompt: string = (typeof ctx.getSystemPrompt === "function" ? ctx.getSystemPrompt() : "") ?? "";
				try {
					const { readFileSync } = await import("node:fs");
					const { join } = await import("node:path");
					const globalAppend = join(process.env.HOME ?? "~", ".pi", "agent", "APPEND_SYSTEM.md");
					const projectAppend = join(ctx.cwd, ".pi", "APPEND_SYSTEM.md");
					let appendContent = "";
					try { appendContent = readFileSync(globalAppend, "utf-8"); } catch { /* no global append */ }
					try { const p = readFileSync(projectAppend, "utf-8"); if (p) appendContent = p; } catch { /* no project append */ }
					if (appendContent && currentPrompt.includes(appendContent.trim())) {
						return { systemPrompt: currentPrompt.replace(appendContent.trim(), "").trim() };
					}
				} catch { /* non-fatal */ }
			}
			return;
		}
		return {
			systemPromptAppend: buildSystemPrompt(),
		};
	});

	// /kobolds command — display the taxonomy with current settings
	pi.registerCommand("kobolds", {
		description: "Show the hoard subagent taxonomy (kobold/griffin/dragon)",
		handler: async (_args, ctx) => {
			ctx.ui.notify(buildTaxonomyDisplay(), "info");
		},
	});

	// /kobolds-regen command — regenerate agent defs from current settings
	pi.registerCommand("kobolds-regen", {
		description: "Regenerate agent definitions from current hoard.kobolds settings",
		handler: async (_args, ctx) => {
			writeAgentDefs(ctx.cwd);
			ctx.ui.notify("Agent defs regenerated from settings", "info");
		},
	});
}
