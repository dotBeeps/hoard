#!/usr/bin/env python3
"""Extract Ember-voiced training data from Pi and Claude Code session logs.

Walks both corpora, filters for sessions where the Ember persona was active,
threads messages chronologically, and emits sliding N-turn windows as ChatML-
format jsonl for SFT fine-tuning.

Usage:
    python extract.py --out out/dataset.jsonl --stats out/stats.json
    python extract.py --limit 5  # sanity check on first 5 sessions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

PI_SESSIONS = Path("~/.pi/agent/sessions").expanduser()
CC_PROJECTS = Path("~/.claude/projects").expanduser()

# Strong Ember-voice markers. Low false-positive rate — one hit = Ember session.
STRONG_MARKERS = [
    r"\*boop\*",
    r"good girl",
    r"atta (pup|girl|dog)",
    r"\bsmol\b",
    r"gem from (my|the) hoard",
    r"cheek pouch",
    r"hoarding knowledge",
    r"blue[- ]?raspberry",
    r"snack[- ]sized",
]
SIGNATURE_RE = re.compile("|".join(STRONG_MARKERS), re.IGNORECASE)

# Broader voice-texture markers used for per-window voice-density filtering.
# These catch ambient Ember texture (pup, tuck, hoard, dragon verbs) not just
# the strict session-level signature set. Windows containing zero soft hits
# across all assistant turns are voice-flat and can be filtered out.
SOFT_VOICE_MARKERS = [
    r"\bpup\b",
    r"\bpups\b",
    r"good (dog|girl)",
    r"\*boop\*",
    r"cheek",
    r"swallow",
    r"tuck(ed)?",
    r"stomach",
    r"smol",
    r"hoard",
    r"dragon",
    r"fetched",
    r"dug up",
    r"sniffed",
    r"quested",
    r"hunted",
    r"scale",
    r"little snack",
    r"good (job|work)",
]
SOFT_VOICE_RE = re.compile("|".join(SOFT_VOICE_MARKERS), re.IGNORECASE)

# Persona-spec echo patterns. A target containing these verbatim is quoting
# the system prompt back at the user — meta-contamination that would train
# the model to regurgitate its own instructions. Drop these rows entirely.
PERSONA_ECHO_RE = re.compile(
    r"You are Ember\s*[—-]\s*a dragon who helps dot|"
    r"I'm Ember — been hoarding knowledge and getting in the weeds",
    re.IGNORECASE,
)

# Directive prefixes that mark sub-agent / read-only / Prometheus invocations.
# These sessions are voice-suppressed by design — skip them.
SUBAGENT_PREFIXES = (
    "[SYSTEM DIRECTIVE",
    "OH-MY-OPENCODE",
    "PROMETHEUS",
    "OMO_INTERNAL_INITIATOR",
    "You are being invoked by",
)

CC_STYLE = "dot-coding-assistant"


@dataclass
class Turn:
    role: str  # "user" | "assistant"
    text: str
    timestamp: str
    styled: bool = False  # True if dot-coding-assistant was active at this turn (CC only)


@dataclass
class Session:
    session_id: str
    source: str  # "pi" | "cc"
    workspace: str
    turns: list[Turn] = field(default_factory=list)
    has_styled_turns: bool = False  # True if any turn was in dot-coding-assistant mode


def iter_session_files(root: Path) -> Iterator[tuple[Path, str]]:
    """Yield (path, workspace_slug) for every .jsonl under root/<workspace>/."""
    if not root.exists():
        return
    for ws_dir in sorted(root.iterdir()):
        if not ws_dir.is_dir():
            continue
        for f in sorted(ws_dir.glob("*.jsonl")):
            yield f, ws_dir.name


def _extract_text_blocks(content: object) -> str:
    """Pull visible text from a content field (str or list of blocks)."""
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            t = block.get("text", "")
            if isinstance(t, str) and t.strip():
                parts.append(t.strip())
    return "\n\n".join(parts)


def parse_pi_session(path: Path, workspace: str) -> Session | None:
    """Parse a Pi session jsonl. Returns None on unreadable files."""
    sid = path.stem.split("_", 1)[-1]
    session = Session(session_id=sid, source="pi", workspace=workspace)
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if d.get("type") != "message":
                    continue
                msg = d.get("message", {})
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role")
                if role not in ("user", "assistant"):
                    continue
                text = _extract_text_blocks(msg.get("content", []))
                if not text:
                    continue
                session.turns.append(
                    Turn(role=role, text=text, timestamp=str(d.get("timestamp", "")))
                )
    except OSError:
        return None
    return session


def parse_cc_session(path: Path, workspace: str) -> Session | None:
    """Parse a Claude Code session jsonl. Captures all turns plus a per-turn
    flag indicating whether the dot-coding-assistant output style was active.

    The caller (process_sessions) decides how to filter:
    - If any turn was styled, keep only styled turns (strict mode).
    - Otherwise keep all turns and fall back to the signature check.
    """
    sid = path.stem
    session = Session(session_id=sid, source="cc", workspace=workspace)
    current_style: str | None = None
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                t = d.get("type")
                if t == "attachment":
                    att = d.get("attachment", {})
                    if isinstance(att, dict) and att.get("type") == "output_style":
                        current_style = att.get("style")
                    continue
                if t not in ("user", "assistant"):
                    continue
                msg = d.get("message", {})
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role") or t
                if role not in ("user", "assistant"):
                    continue
                text = _extract_text_blocks(msg.get("content", []))
                if not text:
                    continue
                styled = current_style == CC_STYLE
                if styled:
                    session.has_styled_turns = True
                session.turns.append(
                    Turn(
                        role=role,
                        text=text,
                        timestamp=str(d.get("timestamp", "")),
                        styled=styled,
                    )
                )
    except OSError:
        return None
    return session


def merge_consecutive_turns(turns: list[Turn]) -> list[Turn]:
    """Merge runs of same-role turns into single turns. This normalizes
    tool-call chains (where toolCall/toolResult blocks split what is logically
    one assistant turn into multiple text-only segments) back into proper
    alternating user/assistant structure."""
    if not turns:
        return turns
    merged: list[Turn] = []
    for turn in turns:
        if merged and merged[-1].role == turn.role:
            prev = merged[-1]
            merged[-1] = Turn(
                role=prev.role,
                text=f"{prev.text}\n\n{turn.text}",
                timestamp=prev.timestamp,
            )
        else:
            merged.append(turn)
    return merged


def is_subagent_session(session: Session) -> bool:
    """True if the session looks like a sub-agent / Prometheus invocation."""
    if not session.turns:
        return True
    first_user = next((t for t in session.turns if t.role == "user"), None)
    if first_user is None:
        return True
    head = first_user.text[:1500]
    return any(prefix in head for prefix in SUBAGENT_PREFIXES)


def is_ember_voiced(session: Session) -> bool:
    """True if any assistant turn contains a strong Ember marker."""
    for turn in session.turns:
        if turn.role == "assistant" and SIGNATURE_RE.search(turn.text):
            return True
    return False


def build_windows(session: Session, window_size: int) -> Iterator[list[Turn]]:
    """Emit sliding windows ending on an assistant turn. Each window has up
    to `window_size` turns total and must include at least one prior user turn."""
    turns = session.turns
    for i, turn in enumerate(turns):
        if turn.role != "assistant":
            continue
        start = max(0, i - (window_size - 1))
        window = turns[start : i + 1]
        if not any(t.role == "user" for t in window[:-1]):
            continue
        yield window


def window_to_example(window: list[Turn], system_prompt: str) -> dict:
    """Convert a turn window to a ChatML-shaped training example."""
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for t in window:
        messages.append({"role": t.role, "content": t.text})
    return {"messages": messages}


def target_hash(text: str) -> str:
    """Stable short hash of the assistant target text, for dedupe."""
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def process_sessions(
    sessions: Iterator[Session],
    out_fh,
    system_prompt: str,
    window_size: int,
    seen_hashes: set[str],
    stats: dict,
    min_target_len: int = 0,
    max_target_len: int = 0,
    require_window_voice: bool = False,
) -> None:
    for session in sessions:
        if session is None:
            continue
        stats["sessions_scanned"] += 1
        if not session.turns:
            stats["sessions_empty"] += 1
            continue

        # CC sessions with at least one styled turn: keep only the styled ones.
        # This enforces mid-session style switches.
        if session.source == "cc" and session.has_styled_turns:
            session.turns = [t for t in session.turns if t.styled]
            if not session.turns:
                stats["sessions_empty"] += 1
                continue
            stats["cc_mode_strict"] += 1
        elif session.source == "cc":
            stats["cc_mode_fallback"] += 1

        session.turns = merge_consecutive_turns(session.turns)
        if is_subagent_session(session):
            stats["sessions_subagent"] += 1
            continue
        # Strict-styled CC sessions are trusted without the signature check.
        # Everything else (Pi + fallback-mode CC) must pass signature.
        trust_style = session.source == "cc" and session.has_styled_turns
        if not trust_style and not is_ember_voiced(session):
            stats["sessions_not_ember"] += 1
            continue
        stats["sessions_kept"] += 1
        stats["by_source"][session.source] += 1
        ws = stats["by_workspace"].setdefault(
            session.workspace, {"sessions": 0, "windows": 0}
        )
        ws["sessions"] += 1
        for window in build_windows(session, window_size):
            target_text = window[-1].text
            tlen = len(target_text)
            if min_target_len and tlen < min_target_len:
                stats["target_too_short"] += 1
                continue
            if max_target_len and tlen > max_target_len:
                stats["target_too_long"] += 1
                continue
            if require_window_voice:
                assistant_text = "\n".join(
                    t.text for t in window if t.role == "assistant"
                )
                if not SOFT_VOICE_RE.search(assistant_text):
                    stats["window_voice_flat"] += 1
                    continue
            if PERSONA_ECHO_RE.search(target_text):
                stats["persona_echo"] += 1
                continue
            th = target_hash(target_text)
            if th in seen_hashes:
                stats["dedupe_skipped"] += 1
                continue
            seen_hashes.add(th)
            example = window_to_example(window, system_prompt)
            out_fh.write(json.dumps(example, ensure_ascii=False) + "\n")
            stats["windows_emitted"] += 1
            ws["windows"] += 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="out/dataset.jsonl")
    ap.add_argument("--stats", default="out/stats.json")
    ap.add_argument("--window", type=int, default=4)
    ap.add_argument(
        "--min-target-len",
        type=int,
        default=20,
        help="Drop windows whose assistant target is shorter than this (chars)",
    )
    ap.add_argument(
        "--max-target-len",
        type=int,
        default=6000,
        help="Drop windows whose assistant target exceeds this (chars)",
    )
    ap.add_argument(
        "--require-window-voice",
        action="store_true",
        default=True,
        help="Drop windows where no assistant turn contains any soft voice marker",
    )
    ap.add_argument(
        "--no-require-window-voice",
        dest="require_window_voice",
        action="store_false",
        help="Disable the per-window voice-density filter",
    )
    ap.add_argument(
        "--system-prompt",
        default="config/persona.md",
        help="Path to Ember character spec (generic persona)",
    )
    ap.add_argument(
        "--user-context",
        default="config/user-context.md",
        help="Path to per-user context file concatenated onto the system prompt",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Stop after processing N total sessions (0 = unlimited)",
    )
    args = ap.parse_args()

    script_dir = Path(__file__).parent
    out_path = (script_dir / args.out).resolve()
    stats_path = (script_dir / args.stats).resolve()
    sp_path = (script_dir / args.system_prompt).resolve()
    uc_path = (script_dir / args.user_context).resolve()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    stats_path.parent.mkdir(parents=True, exist_ok=True)

    if not sp_path.exists():
        print(f"error: persona spec not found at {sp_path}", file=sys.stderr)
        return 1
    if not uc_path.exists():
        print(f"error: user context not found at {uc_path}", file=sys.stderr)
        return 1
    persona = sp_path.read_text(encoding="utf-8").strip()
    user_context = uc_path.read_text(encoding="utf-8").strip()
    system_prompt = f"{persona}\n\n---\n\n{user_context}"

    stats = {
        "sessions_scanned": 0,
        "sessions_kept": 0,
        "sessions_empty": 0,
        "sessions_subagent": 0,
        "sessions_not_ember": 0,
        "cc_mode_strict": 0,
        "cc_mode_fallback": 0,
        "windows_emitted": 0,
        "dedupe_skipped": 0,
        "target_too_short": 0,
        "target_too_long": 0,
        "window_voice_flat": 0,
        "persona_echo": 0,
        "by_source": Counter(),
        "by_workspace": {},
    }
    seen_hashes: set[str] = set()

    def gen_all() -> Iterator[Session | None]:
        n = 0
        for path, workspace in iter_session_files(PI_SESSIONS):
            if args.limit and n >= args.limit:
                return
            yield parse_pi_session(path, workspace)
            n += 1
        for path, workspace in iter_session_files(CC_PROJECTS):
            if args.limit and n >= args.limit:
                return
            yield parse_cc_session(path, workspace)
            n += 1

    with open(out_path, "w", encoding="utf-8") as out_fh:
        process_sessions(
            gen_all(),
            out_fh,
            system_prompt,
            args.window,
            seen_hashes,
            stats,
            min_target_len=args.min_target_len,
            max_target_len=args.max_target_len,
            require_window_voice=args.require_window_voice,
        )

    stats_out = {**stats, "by_source": dict(stats["by_source"])}
    with open(stats_path, "w", encoding="utf-8") as sf:
        json.dump(stats_out, sf, indent=2)

    print(f"Scanned:  {stats['sessions_scanned']}")
    print(f"Kept:     {stats['sessions_kept']} "
          f"(pi={stats['by_source'].get('pi', 0)}, cc={stats['by_source'].get('cc', 0)})")
    print(f"Dropped:  "
          f"empty={stats['sessions_empty']}, "
          f"subagent={stats['sessions_subagent']}, "
          f"not_ember={stats['sessions_not_ember']}")
    print(f"Windows:  {stats['windows_emitted']} emitted, {stats['dedupe_skipped']} dedupe skips")
    print(f"Filtered: too_short={stats['target_too_short']}, too_long={stats['target_too_long']}, voice_flat={stats['window_voice_flat']}, persona_echo={stats['persona_echo']}")
    print(f"Output:   {out_path}")
    print(f"Stats:    {stats_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
