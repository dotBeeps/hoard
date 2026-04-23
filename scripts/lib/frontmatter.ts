/**
 * Zod schema for morsels/skills/*\/SKILL.md frontmatter.
 *
 * Required + optional fields per REQUIREMENTS §TEST-04:
 *   - name: string, non-empty, equals the enclosing skill directory name
 *     (directory-match is enforced in scripts/lint-skills.ts, not here).
 *   - description: string, non-empty, ≤ 1024 chars.
 *   - license: literal "MIT".
 *   - compatibility: typed, optional. Every compatibility value in the live
 *     Phase-1-clean morsels corpus is a free-form string (e.g. dragon-guard:
 *     "Designed for Pi (pi-coding-agent)"). No skill ships a structured
 *     object today, so a stricter union would be premature per PITFALLS §4.
 *
 * Unknown extra fields pass through (`.passthrough()`). The schema is a
 * minimum contract, not a closed-world assertion — if a new frontmatter
 * field becomes a real requirement later, add it here and update
 * morsels/AGENTS.md. Do NOT loosen this schema in Phase 2.
 *
 * This module is import-graph-minimal (only `zod`) so Phase 3 docs tooling
 * can re-export the schema without pulling in fs/path dependencies.
 */
import { z } from "zod";

export const SkillFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1).max(1024),
    license: z.literal("MIT"),
    compatibility: z.string().optional(),
  })
  .passthrough();

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
