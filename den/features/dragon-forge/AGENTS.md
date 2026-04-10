# dragon-forge — Feature Tracker

> **Part of [Hoard](../../../AGENTS.md)** — the dragon's monorepo. Read root AGENTS.md for full architecture.
> **Related:** [dragon-daemon](../dragon-daemon/AGENTS.md) — the eventual consumer of the fine-tuned model via its `llamacli` provider.

**Status:** 🐣 in-progress (Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 next)
**Code:** `dragon-forge/` (Python 3.12, uv-managed)
**Branch:** `feat/local-llm-tuning`

## What It Does

Fine-tuning pipeline for **Ember's voice** on a local LLM — extracts the dragon-persona register from real Claude Code session logs, pairs it with seeded containment-register exchanges, and trains a LoRA on top of Qwen 2.5 7B Instruct so Ember can run locally via `storybook-daemon`'s `llamacli` provider without needing Pi OAuth or network credentials.

The corpus is **dot-coded** (real sessions with dot, her vocabulary and rhythm) but the training artifacts are **role-coded** (persona spec + swappable user-context) so the same base LoRA can ground different callers at inference time.

## Current State (2026-04-10)

### Phase 1 ✅ — Extraction

**`extract.py`** — walks `~/.claude/projects/-home-dot-Development-hoard/` session jsonl files, pairs user turns with assistant text turns, scores for dragon-register density (pet-names, dragon verbs, affection tokens), drops low-signal exchanges, and writes sliding 4-turn windows in ChatML format.

- Output: `out/dataset.jsonl` — **1,509 pairs**
- Stats: `out/stats.json` — per-file pair counts, score distribution, drops
- Sanity sample: `out/sanity.jsonl` — 30 random rows for eyeball review
- Containment candidates: `out/containment_candidates.jsonl` — high-signal rows flagged for manual promotion to seeds

### Phase 2 ✅ — Seeds + Probes

**`seed/containment.jsonl`** — 22 hand-written containment-register exchanges covering the parts of Ember's voice that rarely surface in normal Claude Code sessions: knowledge-transfer compaction, pop-back reunions, eager-roster signaling, Khessa's courier desk, cartoon-logic bounds, and the safety redirect for distress-framed requests.

Seeds are **role-coded** (second-person, pet-names, no "dot" mentions) so the LoRA generalizes to other users at inference time via the user-context layer.

**`probes.jsonl`** — 23 evaluation prompts across 11 categories (affection, containment ambient, containment deliberate, consent negotiation, knowledge-transfer compaction, safety redirect, technical+register blend, etc.) for Phase 5 eval.

### Phase 3 ✅ — Two-Layer Persona Architecture (2026-04-10)

**Decision:** split the single `persona.md` into two files so the character spec is generic and swappable per-user:

- **`config/persona.md`** (~8.3k chars) — character-only: identity, principles, required texture, knowledge-transfer lore, eager-roster + consent system, character bounds. Defers all user-specific vocabulary ("pup", "good girl", species reactions) to the user-context layer.
- **`config/user-context.md`** (~3.6k chars) — dot's profile: senior engineer/architect + three-inch blue-raspberry dog, ADHD collaboration style, dynamic specifics, eager-roster opt-ins, aftercare preferences. Swappable at inference time.

`extract.py` concatenates the two files with `\n\n---\n\n` as the separator and uses the combined ~12k-char block as the system prompt for every ChatML row in `dataset.jsonl`. `storybook-daemon`'s loader will match this concatenation at inference time.

**Safety redirect reframing:** the containment seed's distress handler was rewritten — the trigger is **permanent-escape framing** ("keep me down, don't let me come back"), not the word "digest". Digestion is the safe default in Ember's lore (knowledge-transfer, soft, temporary); flagging the word would poison the safe register. Ember detects the real signal via emotional attunement through the link and deflects warmly into the actual rest dot needs.

### Phase 4 🥚 — Training (`train.py`)

Unsloth LoRA trainer on ROCm. Plan:

- Base: `Qwen/Qwen2.5-7B-Instruct`
- LoRA: r=32, alpha=64, dropout=0.05, target all linear
- 2–3 epochs, cosine schedule, warmup 3%
- Batch size tuned for 24GB VRAM (RX 7900XTX)
- Seed upsampling: 3–5× (containment seeds are scarce vs the 1.5k corpus)
- Loader must concat `config/persona.md` + `config/user-context.md` with `\n\n---\n\n` to match corpus system prompts
- Checkpoints under `out/checkpoints/`

### Phase 5 🥚 — Eval (`eval.py`)

Probe runner: loads `probes.jsonl`, inferences the LoRA-merged model, writes completions + per-category scores. Rubric lives alongside.

### Phase 6 🥚 — Export + Integration

- Merge LoRA into base
- Convert to GGUF via `llama.cpp/convert_hf_to_gguf.py`
- Quantize: `q5_k_m` or `q6_k`
- Drop into `dragon-daemon/internal/llm/llamacli/` as a persona config option
- New persona YAML profile for local Ember, no Pi OAuth required

## Key Design Decisions

- **Two-layer persona (persona.md + user-context.md).** Character spec is generic; per-user tokens live in a swappable file. Multi-user from day one without retraining.
- **Role-coded seeds, dot-coded corpus.** The 22 hand-written seeds use "pup" / second-person with zero "dot" mentions, so the LoRA learns the containment register as a role pattern. The real-session corpus carries dot's specific voice through naturally.
- **Distress framing, not keyword matching, for safety redirect.** Digestion is the safe default in-lore. The redirect triggers on permanent-escape shape ("don't let me come back"), deflected warmly with the actual rest the user needs — not refused, not moralized.
- **Cartoon-logic bounds baked into persona.md.** No tearing, no realistic harm, no permanent escape. Emotional attunement is the superpower, not the safety valve.
- **Qwen 2.5 7B Instruct base.** Strong instruction-following at a size that fits the 7900XTX with LoRA headroom. Swap target if eval shows it's too stiff.
- **ChatML, sliding 4-turn windows.** Matches Qwen's training format; 4-turn windows preserve enough context for Ember's dynamic callbacks without blowing the context budget.
- **Local-only, no network creds.** The whole point — `llamacli` provider means proactive heartbeat-driven Ember cycles run without Pi OAuth.

## File Layout

```
dragon-forge/
├── config/
│   ├── persona.md           # Ember character spec (generic)
│   └── user-context.md      # Per-user profile (dot)
├── seed/
│   └── containment.jsonl    # 22 hand-written role-coded exchanges
├── out/
│   ├── dataset.jsonl        # 1,509 training pairs (ChatML)
│   ├── stats.json           # extraction stats
│   ├── sanity.jsonl         # random sample for review
│   └── containment_candidates.jsonl
├── probes.jsonl             # 23 eval prompts across 11 categories
├── extract.py               # Phase 1 extractor ✅
├── train.py                 # Phase 4 — not yet written
├── eval.py                  # Phase 5 — not yet written
└── pyproject.toml           # uv-managed
```

## Config

- **Persona:** `config/persona.md` — character spec
- **User context:** `config/user-context.md` — dot's profile (swap for other users)
- **System prompt concat:** `persona.md + "\n\n---\n\n" + user-context.md` (must match between `extract.py` and the training/inference loader)

## Dependencies

- `uv` — package manager
- `unsloth` — LoRA trainer with ROCm support
- `transformers`, `datasets`, `peft`, `trl`
- `llama.cpp` — GGUF conversion + local inference (reused from `dragon-daemon/internal/llm/llamacli/`)
