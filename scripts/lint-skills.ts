#!/usr/bin/env node
/**
 * morsels/skills/*\/SKILL.md linter per REQUIREMENTS §TEST-04.
 *
 * Run via: node --experimental-strip-types scripts/lint-skills.ts
 * (also wired as `pnpm lint:skills` at repo root — see 02-01).
 *
 * Validates:
 *   - frontmatter against scripts/lib/frontmatter.ts SkillFrontmatterSchema
 *   - frontmatter.name equals the enclosing directory name
 *   - body text rejects stale Symbol.for("hoard.*") residue (PITFALLS §1)
 *   - body text rejects Symbol.for("pantry.<X>") where <X> is not a live
 *     PANTRY_KEYS key (ingested dynamically from berrygems/lib/globals.ts
 *     per D-14; regex fallback if dynamic import chokes) (PITFALLS §3)
 *
 * Exit codes per D-15:
 *   0 — clean run, all skills pass
 *   1 — any violation (frontmatter, body residue, or unknown pantry key)
 *   2 — internal crash (distinct from a lint violation)
 *
 * Diagnostics go to stderr (grouped per skill); only the final success line
 * goes to stdout, so CI can separate streams cleanly. No ANSI color codes —
 * CI logs don't render them well.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { SkillFrontmatterSchema } from "./lib/frontmatter.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const MORSELS_ROOT = join(REPO_ROOT, "morsels", "skills");
const GLOBALS_PATH = join(REPO_ROOT, "berrygems", "lib", "globals.ts");

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const HOARD_SYMBOL_RE = /Symbol\.for\(\s*["']hoard\.([^"']+)["']\s*\)/g;
const PANTRY_SYMBOL_RE = /Symbol\.for\(\s*["']pantry\.([^"']+)["']\s*\)/g;

// ── Ingest live PANTRY_KEYS (D-14 preferred: dynamic import; fallback: regex) ──
async function loadPantryKeys(): Promise<Set<string>> {
  try {
    const mod = await import(GLOBALS_PATH);
    if (
      mod &&
      typeof mod.PANTRY_KEYS === "object" &&
      mod.PANTRY_KEYS !== null
    ) {
      return new Set(Object.keys(mod.PANTRY_KEYS));
    }
    // Fall through to regex if the shape is unexpected.
  } catch {
    // Fall through to regex fallback on any import failure.
  }
  // Fallback: scrape keys from globals.ts source (D-14, case c).
  const src = readFileSync(GLOBALS_PATH, "utf-8");
  const match = src.match(/PANTRY_KEYS\s*=\s*\{([\s\S]*?)\}\s*as\s*const/);
  if (!match) {
    throw new Error(
      `lint-skills: unable to extract PANTRY_KEYS from ${GLOBALS_PATH}; update the fallback regex.`,
    );
  }
  const keys = new Set<string>();
  const keyRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(match[1]!)) !== null) {
    keys.add(m[1]!);
  }
  return keys;
}

// ── Main walk ──
async function main(): Promise<void> {
  const validPantryKeys = await loadPantryKeys();

  const skillDirs = readdirSync(MORSELS_ROOT).filter((d) =>
    statSync(join(MORSELS_ROOT, d)).isDirectory(),
  );

  let totalSkills = 0;
  let totalViolations = 0;
  const failedSkills: string[] = [];

  for (const dir of skillDirs.sort()) {
    const skillPath = join(MORSELS_ROOT, dir, "SKILL.md");
    let raw: string;
    try {
      raw = readFileSync(skillPath, "utf-8");
    } catch {
      // Skip directories without a SKILL.md (shouldn't happen, but be safe).
      continue;
    }
    totalSkills++;

    const issues: string[] = [];

    // (1) Frontmatter block presence.
    const fmMatch = raw.match(FRONTMATTER_RE);
    if (!fmMatch) {
      issues.push(
        `missing '---\\n...\\n---\\n' frontmatter block at top of file`,
      );
    } else {
      // (2) YAML parse.
      let parsed: unknown;
      try {
        parsed = parseYaml(fmMatch[1]!);
      } catch (err) {
        issues.push(`YAML parse error: ${(err as Error).message}`);
      }

      // (3) Zod validate.
      if (parsed !== undefined) {
        const result = SkillFrontmatterSchema.safeParse(parsed);
        if (!result.success) {
          for (const issue of result.error.issues) {
            issues.push(
              `frontmatter.${issue.path.join(".") || "(root)"}: ${issue.message}`,
            );
          }
        } else {
          // Extra cross-check per REQUIREMENTS §TEST-04: name === directory.
          if (result.data.name !== dir) {
            issues.push(
              `frontmatter.name "${result.data.name}" does not match skill directory "${dir}"`,
            );
          }
        }
      }

      // (4) Body scans — always run if body is present, regardless of frontmatter validity.
      const body = fmMatch[2] ?? "";
      HOARD_SYMBOL_RE.lastIndex = 0;
      let hm: RegExpExecArray | null;
      while ((hm = HOARD_SYMBOL_RE.exec(body)) !== null) {
        issues.push(
          `body contains stale Symbol.for("hoard.${hm[1]}") residue (pantry amputation complete — remove)`,
        );
      }
      PANTRY_SYMBOL_RE.lastIndex = 0;
      let pm: RegExpExecArray | null;
      while ((pm = PANTRY_SYMBOL_RE.exec(body)) !== null) {
        const key = pm[1]!;
        if (!validPantryKeys.has(key)) {
          issues.push(
            `body references unknown Symbol.for("pantry.${key}") — not a key of PANTRY_KEYS (known: ${[...validPantryKeys].sort().join(", ")})`,
          );
        }
      }
    }

    if (issues.length > 0) {
      totalViolations += issues.length;
      failedSkills.push(dir);
      // Per-skill grouped diagnostics block per D-15.
      console.error(`\nx ${dir}:`);
      for (const issue of issues) {
        console.error(`    - ${issue}`);
      }
    }
  }

  if (totalViolations > 0) {
    console.error(
      `\nx lint-skills: ${failedSkills.length} of ${totalSkills} skills failed (${totalViolations} violations): ${failedSkills.join(", ")}`,
    );
    process.exit(1);
  } else {
    console.log(`ok lint-skills: all ${totalSkills} skills passed`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("lint-skills crashed:", err);
  process.exit(2);
});
