#!/usr/bin/env fish
# Stop hook (project-scoped): nudge when dragon-forge phase artifacts were
# edited without updating the living AGENTS.md phase state. Warning-only.
#
# Phase artifacts (dragon-forge):
#   - seed/*, config/*, train.py, eval.py, extract.py
# Gate: require an edit to den/features/dragon-forge/AGENTS.md in the same
# session, otherwise print a reminder.

set -l payload (cat)
set -l logdir ~/.claude/logs
set -l log $logdir/stop-hooks.log
mkdir -p $logdir

set -l report (echo $payload | python3 -c '
import json
import re
import sys
from pathlib import Path

try:
    d = json.loads(sys.stdin.read())
except json.JSONDecodeError:
    sys.exit(0)

tp = d.get("transcript_path")
if not tp or not Path(tp).exists():
    sys.exit(0)

text = Path(tp).read_text(errors="replace")
fps = re.findall(r"\"file_path\"\s*:\s*\"([^\"]+)\"", text)

artifact_re = re.compile(
    r"dragon-forge/(seed/|config/|train\.py|eval\.py|extract\.py)"
)
touched = [f for f in fps if artifact_re.search(f)]
agents_touched = any("dragon-forge/AGENTS.md" in f for f in fps)

if touched and not agents_touched:
    uniq = len(set(touched))
    print(
        f"dragon-forge: {uniq} phase-artifact file(s) edited but AGENTS.md "
        f"unchanged — update phase state before stopping?"
    )
' 2>/dev/null)

if test -n "$report"
    set -l ts (date +%Y-%m-%dT%H:%M:%S)
    echo "$ts phase-gate: $report" >> $log
    echo "⚠ phase-gate: $report"
end
exit 0
