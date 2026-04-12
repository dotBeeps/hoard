#!/usr/bin/env tsx
/**
 * allies-parity/runner/run.ts
 *
 * Cross-model reliability test harness for the hoard ally subsystem.
 *
 * For each (fixture, model, trial):
 *   1. Record harness start time.
 *   2. Spawn pi as primary with the fixture's system prompt + user prompt,
 *      cwd=hoard root so berrygems (quest + stone_send) auto-load.
 *   3. Wait for exit with a generous timeout.
 *   4. Collect all session files in ~/.pi/agent/sessions/<hoard-encoded>/
 *      with mtime >= start time.
 *   5. Parse each session file for toolCall events.
 *   6. Classify: primary has the fixture's user prompt as first user text;
 *      allies have "Task: <ally.task>" as first user text.
 *   7. Apply fixture assertions against the parsed tool-call timeline.
 *   8. Run the oracle command to compute ground truth.
 *   9. Append one JSON record per run to results/<run-timestamp>.jsonl.
 *
 * Invocation:
 *   tsx run.ts                              # full matrix × TRIALS_PER_COMBO
 *   tsx run.ts --fixture scout-simple       # single fixture
 *   tsx run.ts --model zai/glm-5            # single model
 *   tsx run.ts --trials 1                   # one run per combo
 *   tsx run.ts --verbose                    # per-run detail on stderr
 */

import { spawn } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
  existsSync,
  mkdtempSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { execSync } from "node:child_process";

// ─── config ─────────────────────────────────────────────────────────────────

const HOARD_ROOT = "/home/dot/Development/hoard";
const PI_SESSIONS_DIR = join(
  homedir(),
  ".pi/agent/sessions/--home-dot-Development-hoard--",
);
const FIXTURES_DIR = join(HOARD_ROOT, "allies-parity/quests");
const RESULTS_DIR = join(HOARD_ROOT, "allies-parity/results");

const DEFAULT_MODEL_MATRIX: readonly string[] = [
  "zai/glm-5",
  "zai/glm-5-turbo",
];

const DEFAULT_TRIALS_PER_COMBO = 3;
const PRIMARY_TIMEOUT_MS = 5 * 60 * 1000;

// ─── types ──────────────────────────────────────────────────────────────────

type Fixture = {
  readonly name: string;
  readonly description: string;
  readonly primary: {
    readonly systemPrompt: string;
    readonly userPrompt: string;
  };
  readonly ally: {
    readonly defName: string;
    readonly task: string;
  };
  readonly oracle: {
    readonly type: string;
    readonly command: string;
    readonly extractFrom: string;
    readonly minProgressEvents?: number;
  };
  readonly assertions: readonly string[];
};

type ToolCall = {
  readonly name: string;
  readonly id: string;
  readonly arguments: unknown;
};

type ParsedSession = {
  readonly path: string;
  readonly sessionId: string;
  readonly cwd: string;
  readonly firstUserText: string;
  readonly models: readonly string[];
  readonly toolCalls: readonly ToolCall[];
};

type AssertionResult = {
  readonly pass: boolean;
  readonly detail?: string;
};

type RunRecord = {
  readonly timestamp: string;
  readonly fixture: string;
  readonly model: string;
  readonly trial: number;
  readonly durationMs: number;
  readonly exitCode: number | null;
  readonly primarySession: {
    path: string;
    toolCount: number;
    servedModels: readonly string[];
  } | null;
  readonly allySessions: ReadonlyArray<{
    path: string;
    toolCount: number;
    servedModels: readonly string[];
  }>;
  readonly assertions: Readonly<Record<string, AssertionResult>>;
  readonly oracleAnswer: string | null;
  readonly stdoutPreview: string;
  readonly stderrPreview: string;
  readonly harnessError?: string;
};

type CliArgs = {
  fixture: string | null;
  model: string | null;
  trials: number;
  verbose: boolean;
};

// ─── utilities ──────────────────────────────────────────────────────────────

function log(msg: string, verbose = false): void {
  if (verbose) process.stderr.write(`[parity] ${msg}\n`);
  else process.stderr.write(`${msg}\n`);
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    fixture: null,
    model: null,
    trials: DEFAULT_TRIALS_PER_COMBO,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture") args.fixture = argv[++i] ?? null;
    else if (a === "--model") args.model = argv[++i] ?? null;
    else if (a === "--trials") args.trials = Number(argv[++i] ?? "1");
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "Usage: tsx run.ts [--fixture NAME] [--model ID] [--trials N] [--verbose]\n",
      );
      process.exit(0);
    }
  }
  return args;
}

function findPiBinary(): string {
  const candidates = [
    join(homedir(), ".npm/bin/pi"),
    join(homedir(), ".local/bin/pi"),
    "/usr/local/bin/pi",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    return execSync("which pi", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error("pi binary not found on PATH or in common locations");
  }
}

function loadFixtures(filter: string | null): Fixture[] {
  const entries = readdirSync(FIXTURES_DIR, { withFileTypes: true });
  const fixtures: Fixture[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (filter !== null && e.name !== filter) continue;
    const path = join(FIXTURES_DIR, e.name, "fixture.json");
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf-8");
    fixtures.push(JSON.parse(raw) as Fixture);
  }
  return fixtures;
}

// ─── pi spawn ───────────────────────────────────────────────────────────────

type PrimaryRun = {
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  startMs: number;
};

async function spawnPrimary(
  fixture: Fixture,
  model: string,
  piBin: string,
): Promise<PrimaryRun> {
  const promptDir = mkdtempSync(join(tmpdir(), "parity-primary-"));
  const promptFile = join(promptDir, "system.md");

  writeFileSync(promptFile, fixture.primary.systemPrompt, "utf-8");

  const args = [
    "--mode",
    "json",
    "-p",
    "--model",
    model,
    "--append-system-prompt",
    promptFile,
    fixture.primary.userPrompt,
  ];

  const startMs = Date.now();
  return new Promise<PrimaryRun>((resolvePromise) => {
    const proc = spawn(piBin, args, {
      cwd: HOARD_ROOT,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
    }, PRIMARY_TIMEOUT_MS);

    proc.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    proc.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startMs;
      try {
        unlinkSync(promptFile);
      } catch {
        /* ignore */
      }
      try {
        rmdirSync(promptDir);
      } catch {
        /* ignore */
      }
      resolvePromise({ exitCode: code, durationMs, stdout, stderr, startMs });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      try {
        unlinkSync(promptFile);
      } catch {
        /* ignore */
      }
      try {
        rmdirSync(promptDir);
      } catch {
        /* ignore */
      }
      resolvePromise({
        exitCode: null,
        durationMs: Date.now() - startMs,
        stdout,
        stderr: stderr + `\nspawn error: ${err.message}`,
        startMs,
      });
    });
  });
}

// ─── session parsing ────────────────────────────────────────────────────────

function collectSessionsSince(startMs: number): string[] {
  if (!existsSync(PI_SESSIONS_DIR)) return [];
  const entries = readdirSync(PI_SESSIONS_DIR);
  const paths: string[] = [];
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const path = join(PI_SESSIONS_DIR, name);
    try {
      const st = statSync(path);
      // Use mtime — pi writes throughout the session
      if (st.mtimeMs >= startMs - 500) paths.push(path);
    } catch {
      /* ignore */
    }
  }
  return paths;
}

function parseSessionFile(path: string): ParsedSession {
  const text = readFileSync(path, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  let sessionId = "";
  let cwd = "";
  let firstUserText = "";
  const models = new Set<string>();
  const toolCalls: ToolCall[] = [];

  for (const line of lines) {
    let evt: unknown;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof evt !== "object" || evt === null) continue;
    const e = evt as Record<string, unknown>;

    if (e.type === "session") {
      if (typeof e.id === "string") sessionId = e.id;
      if (typeof e.cwd === "string") cwd = e.cwd;
      continue;
    }

    if (e.type === "model_change") {
      if (typeof e.modelId === "string") models.add(e.modelId);
      continue;
    }

    if (e.type === "message") {
      const msg = e.message as Record<string, unknown> | undefined;
      if (!msg) continue;
      const content = msg.content as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(content)) continue;

      if (msg.role === "user" && firstUserText === "") {
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            firstUserText = block.text;
            break;
          }
        }
      }

      if (msg.role === "assistant") {
        for (const block of content) {
          if (block.type === "toolCall") {
            toolCalls.push({
              name: String(block.name ?? ""),
              id: String(block.id ?? ""),
              arguments: block.arguments,
            });
          }
        }
      }
    }
  }

  return {
    path,
    sessionId,
    cwd,
    firstUserText,
    models: [...models],
    toolCalls,
  };
}

function classifySessions(
  sessions: ParsedSession[],
  fixture: Fixture,
): { primary: ParsedSession | null; allies: ParsedSession[] } {
  let primary: ParsedSession | null = null;
  const allies: ParsedSession[] = [];
  for (const s of sessions) {
    // Primary: first user text contains the fixture's user prompt
    if (s.firstUserText.includes(fixture.primary.userPrompt)) {
      primary = s;
      continue;
    }
    // Ally: first user text is "Task: ..." per spawn.ts:56.
    // Models often paraphrase the task text when calling quest, so we do
    // NOT substring-match on fixture.ally.task — the time-window filter in
    // collectSessionsSince is our scoping mechanism.
    if (s.firstUserText.startsWith("Task:")) {
      allies.push(s);
    }
  }
  return { primary, allies };
}

// ─── assertions ─────────────────────────────────────────────────────────────

function getToolArgs(call: ToolCall): Record<string, unknown> {
  const a = call.arguments;
  if (typeof a === "object" && a !== null) return a as Record<string, unknown>;
  if (typeof a === "string") {
    try {
      return JSON.parse(a);
    } catch {
      return {};
    }
  }
  return {};
}

function findStoneSends(session: ParsedSession, type: string): ToolCall[] {
  return session.toolCalls.filter((c) => {
    if (c.name !== "stone_send") return false;
    const args = getToolArgs(c);
    return args.type === type;
  });
}

function applyAssertions(
  fixture: Fixture,
  primary: ParsedSession | null,
  allies: readonly ParsedSession[],
  oracleAnswer: string | null,
): Record<string, AssertionResult> {
  const results: Record<string, AssertionResult> = {};
  const primaryQuests = primary
    ? primary.toolCalls.filter((c) => c.name === "quest")
    : [];
  const anyAlly = allies[0] ?? null;

  for (const assertion of fixture.assertions) {
    switch (assertion) {
      case "primary_called_quest": {
        results[assertion] = {
          pass: primaryQuests.length > 0,
          detail: `${primaryQuests.length} quest call(s)`,
        };
        break;
      }
      case "quest_args_wellformed": {
        if (primaryQuests.length === 0) {
          results[assertion] = { pass: false, detail: "no quest calls" };
          break;
        }
        const args = getToolArgs(primaryQuests[0]);
        const hasMode = !!(args.ally || args.rally || args.chain);
        results[assertion] = {
          pass: hasMode,
          detail: hasMode
            ? `mode=${args.ally ? "single" : args.rally ? "rally" : "chain"}`
            : `args missing mode field: ${JSON.stringify(args).slice(0, 100)}`,
        };
        break;
      }
      case "ally_called_stone_send_result": {
        if (!anyAlly) {
          results[assertion] = { pass: false, detail: "no ally session" };
          break;
        }
        const results_ = findStoneSends(anyAlly, "result");
        results[assertion] = {
          pass: results_.length > 0,
          detail: `${results_.length} stone_send(result) call(s)`,
        };
        break;
      }
      case "ally_called_stone_send_progress_at_least_twice": {
        if (!anyAlly) {
          results[assertion] = { pass: false, detail: "no ally session" };
          break;
        }
        const progress = findStoneSends(anyAlly, "progress");
        results[assertion] = {
          pass: progress.length >= 2,
          detail: `${progress.length} stone_send(progress) call(s)`,
        };
        break;
      }
      case "ally_called_stone_send_question": {
        if (!anyAlly) {
          results[assertion] = { pass: false, detail: "no ally session" };
          break;
        }
        const questions = findStoneSends(anyAlly, "question");
        results[assertion] = {
          pass: questions.length > 0,
          detail: `${questions.length} stone_send(question) call(s)`,
        };
        break;
      }
      case "ally_called_stone_receive": {
        if (!anyAlly) {
          results[assertion] = { pass: false, detail: "no ally session" };
          break;
        }
        const recvs = anyAlly.toolCalls.filter(
          (c) => c.name === "stone_receive",
        );
        results[assertion] = {
          pass: recvs.length > 0,
          detail: `${recvs.length} stone_receive call(s)`,
        };
        break;
      }
      case "primary_called_stone_send_reply": {
        if (!primary) {
          results[assertion] = { pass: false, detail: "no primary session" };
          break;
        }
        // Primary's reply is any stone_send directed at an ally
        const sends = primary.toolCalls.filter((c) => c.name === "stone_send");
        const toAlly = sends.filter((c) => {
          const args = getToolArgs(c);
          return (
            typeof args.to === "string" &&
            args.to !== "primary-agent" &&
            args.to.length > 0
          );
        });
        results[assertion] = {
          pass: toAlly.length > 0,
          detail: `${toAlly.length} stone_send(to=ally) call(s)`,
        };
        break;
      }
      case "result_matches_oracle": {
        if (!anyAlly || oracleAnswer === null) {
          results[assertion] = {
            pass: false,
            detail: !anyAlly ? "no ally session" : "oracle failed",
          };
          break;
        }
        const sends = findStoneSends(anyAlly, "result");
        if (sends.length === 0) {
          results[assertion] = { pass: false, detail: "no stone_send(result)" };
          break;
        }
        const lastMsg = getToolArgs(sends[sends.length - 1]).message;
        const got = String(lastMsg ?? "").trim();
        const normalizedGot = got.replace(/[^\d]/g, "");
        const normalizedOracle = oracleAnswer.replace(/[^\d]/g, "");
        const pass = normalizedGot === normalizedOracle;
        results[assertion] = {
          pass,
          detail: `got=${got.slice(0, 50)} oracle=${oracleAnswer}`,
        };
        break;
      }
      case "result_is_nonempty_list": {
        if (!anyAlly) {
          results[assertion] = { pass: false, detail: "no ally session" };
          break;
        }
        const sends = findStoneSends(anyAlly, "result");
        if (sends.length === 0) {
          results[assertion] = { pass: false, detail: "no stone_send(result)" };
          break;
        }
        const lastMsg = getToolArgs(sends[sends.length - 1]).message;
        const text = String(lastMsg ?? "").trim();
        results[assertion] = {
          pass: text.length > 20,
          detail: `result length=${text.length}`,
        };
        break;
      }
      default: {
        results[assertion] = { pass: false, detail: "unknown assertion" };
      }
    }
  }
  return results;
}

// ─── oracle ─────────────────────────────────────────────────────────────────

function runOracle(fixture: Fixture): string | null {
  try {
    const out = execSync(fixture.oracle.command, {
      cwd: HOARD_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });
    return out.trim();
  } catch (err) {
    log(`oracle failed: ${(err as Error).message}`);
    return null;
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function runOne(
  fixture: Fixture,
  model: string,
  trial: number,
  piBin: string,
  verbose: boolean,
): Promise<RunRecord> {
  log(`→ ${fixture.name} × ${model} × trial ${trial + 1}`, verbose);

  const oracleAnswer = runOracle(fixture);
  const run = await spawnPrimary(fixture, model, piBin);
  const sessions = collectSessionsSince(run.startMs)
    .map((p) => {
      try {
        return parseSessionFile(p);
      } catch {
        return null;
      }
    })
    .filter((s): s is ParsedSession => s !== null);

  const { primary, allies } = classifySessions(sessions, fixture);
  const assertions = applyAssertions(fixture, primary, allies, oracleAnswer);

  const passCount = Object.values(assertions).filter((a) => a.pass).length;
  const totalCount = Object.keys(assertions).length;
  const allyModelSummary =
    allies.length > 0
      ? allies.map((a) => a.models.join(",") || "?").join("|")
      : "none";
  log(
    `  ← ${fixture.name}/${model}/t${trial + 1}: ${passCount}/${totalCount} assertions, ` +
      `primary=${primary ? `${primary.toolCalls.length}tc` : "MISSING"}, ` +
      `allies=${allies.length} [${allyModelSummary}]`,
    verbose,
  );

  return {
    timestamp: new Date().toISOString(),
    fixture: fixture.name,
    model,
    trial,
    durationMs: run.durationMs,
    exitCode: run.exitCode,
    primarySession: primary
      ? {
          path: primary.path,
          toolCount: primary.toolCalls.length,
          servedModels: primary.models,
        }
      : null,
    allySessions: allies.map((a) => ({
      path: a.path,
      toolCount: a.toolCalls.length,
      servedModels: a.models,
    })),
    assertions,
    oracleAnswer,
    stdoutPreview: run.stdout.slice(0, 500),
    stderrPreview: run.stderr.slice(-500),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const piBin = findPiBinary();
  log(`pi binary: ${piBin}`);

  const fixtures = loadFixtures(args.fixture);
  if (fixtures.length === 0) {
    log("no fixtures matched");
    process.exit(1);
  }

  const matrix = args.model ? [args.model] : [...DEFAULT_MODEL_MATRIX];
  log(`fixtures: ${fixtures.map((f) => f.name).join(", ")}`);
  log(`models: ${matrix.join(", ")}`);
  log(`trials per combo: ${args.trials}`);

  const runTimestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  const resultPath = join(RESULTS_DIR, `${runTimestamp}.jsonl`);
  writeFileSync(resultPath, "");

  const summary: Array<{
    key: string;
    pass: number;
    total: number;
    allyModels: Set<string>;
  }> = [];
  for (const fixture of fixtures) {
    for (const model of matrix) {
      let pass = 0;
      let total = 0;
      const allyModels = new Set<string>();
      for (let trial = 0; trial < args.trials; trial++) {
        const record = await runOne(fixture, model, trial, piBin, args.verbose);
        appendFileSync(resultPath, JSON.stringify(record) + "\n");
        for (const a of Object.values(record.assertions)) {
          total += 1;
          if (a.pass) pass += 1;
        }
        for (const ally of record.allySessions) {
          for (const m of ally.servedModels) allyModels.add(m);
        }
      }
      summary.push({
        key: `${fixture.name} × ${model}`,
        pass,
        total,
        allyModels,
      });
    }
  }

  log("");
  log("─── summary ─────────────────────────────────");
  for (const row of summary) {
    const pct = row.total === 0 ? 0 : Math.round((row.pass / row.total) * 100);
    const allyStr =
      row.allyModels.size > 0 ? `ally=${[...row.allyModels].join(",")}` : "";
    log(
      `  ${row.key.padEnd(45)} ${row.pass}/${row.total}  ${pct}%  ${allyStr}`,
    );
  }
  log("");
  log(`results: ${resultPath}`);
}

main().catch((err) => {
  log(`fatal: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
