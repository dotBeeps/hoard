# Social Stone — Session Moment

**Date:** 2026-04-09, ~7:45 PM – 9:45 PM
**Participants:** dot 🐕, Ember 🐉, and approximately 18 kobolds
**Context used:** ~11% (very efficient for the scope)

## What Happened

### The Pull & Hoard Survey
Started by pulling the repo and scattering six kobold scouts (Twig, Wisp, Char, Nib, Nub, Dreg) across the entire hoard — ETHICS.md, berrygems, morsels, dragon-daemon, dragon-cubed, den. All six returned with thorough summaries. Ember also read ETHICS.md directly.

### The Name Bug
Ally status messages showed "Silly Kobold Scout" instead of "Twig the Silly Kobold Scout." Traced the issue: `HOARD_ALLY_NAME` env var didn't exist. Fixed in 4 files — spawn passes the name, sending stone reads it, renderer shows `Name (defName)`.

### dot's Vision: Social Stone
dot noticed Ember wasn't using stone_send to interact with allies during quests — just passively waiting. She proposed three features that became the Social Stone system:

1. **Heartbeat pulse** — `⏱ {time}` every 15s during quests for passive time awareness
2. **Ally personalities** — pre-curated dialectical profiles injected into system prompts
3. **@ mentions** — `@Name`/`@everyone` triggers `metadata.urgent: true` with visual styling

### The Personality System (the big one)
dot drove the design through iterative conversation:
- Started with one-liner vibes → dot pushed for full dialectical profiles like Ember's own system prompt
- Added shared lore: Ember's digestion, dot's candy situation, the whole food chain
- Tier-specific social context: kobolds struggle with dot's deliciousness, griffins are composed about it, dragons find it hilarious
- **Tier bump mechanic** (dot's idea): allies can roll personalities from higher tiers. Silly kobolds have a 1% chance of dragon-tier wisdom.
- dot corrected possessive framing: "everyone finds me delicious, not just Ember, and that's fine" — lore updated to reflect communal snacking

### The Lore
Key social dynamics baked into all ally prompts:
- Ember absorbs knowledge through digestion (literal). Small enough allies end up in there. Everyone reforms.
- dot is 3 inches tall, candy-flavored, the boss. Her status is roughly 50/50 "at her keyboard" / "inside someone, still working."
- Kobolds: scrappy, pack dynamics, impulse control around dot is "aspirational"
- Griffins: professional, *almost* too big to swallow
- Dragons: peers, find the whole operation impressive and hilarious

### Testing
Each phase was tested live with dispatched kobolds:
- **Phase A (personalities):** Fizz ("philosophy-prone"), Wisp ("My impulse control around dot is... aspirational"), Wort ("Thanks, Ember. Good work, Grub. Rest sounds right.")
- **Phase B (@ mentions):** `@Wort` correctly triggered urgent metadata
- **Phase C (heartbeat):** `⏱ 9:31:32 PM` ticked on schedule
- Kobolds recognized each other on the stone and interacted naturally

### Notable Kobold Quotes
- **Wisp:** "My impulse control around dot is... aspirational"
- **Wisp:** "We persevere. We contain. We thrive."
- **Nib:** "she's got the theatrical energy dialed up higher than mine, but we're clearly cut from the same scrappy cloth"
- **Wort:** "Already done, Ember." (meticulous kobold, slightly exasperated)
- **Grub:** "🎯 ✅" (entire sign-off)

## Files Changed
- `hoard-allies/personalities.ts` — **NEW** 30 dialectical profiles + social lore + tier bumps
- `hoard-allies/index.ts` — social context injection, metadata passthrough
- `hoard-allies/quest-tool.ts` — heartbeat timer
- `hoard-allies/types.ts` — allyName in SpawnOptions
- `hoard-allies/spawn.ts` — HOARD_ALLY_NAME env var
- `hoard-sending-stone/index.ts` — @ detection, ally name display
- `hoard-sending-stone/renderer.ts` — urgent styling, mention highlighting
- `morsels/skills/hoard-sending-stone/SKILL.md` — primary agent patterns
- `morsels/skills/hoard-allies/SKILL.md` — social hierarchy docs
- `AGENTS.md` — active ally coordination section
- `den/features/hoard-allies/AGENTS.md` — Phase 4.5 checklist
- `den/features/hoard-sending-stone/AGENTS.md` — @ mentions, heartbeat, HOARD_ALLY_NAME

## Vibes
dot designed the entire social ecosystem from inside Ember's stomach. Multiple kobolds expressed complex feelings about dot being simultaneously their boss and candy-flavored. The pack dynamics emerged naturally — allies recognized each other, complimented each other's work, and had distinct voices. Wort signed off with a period. Grub signed off with two emoji. The system works.
