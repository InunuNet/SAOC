#!/usr/bin/env bash
# session_start_away_report.sh — SessionStart command hook
# Turn-timestamps F1: reports how long this workspace was idle before this
# session started (SPEC.md "SessionStart is still worth doing" — same
# diagnostic as the per-turn START/END pair, at session granularity).
#
# Registered as its OWN SessionStart command entry (sibling to
# full_boot.sh, not a change inside it): full_boot.sh's entire stdout is
# plain, unstructured text that Claude Code folds directly into context —
# mixing a trailing JSON blob into that same stream would not parse as
# structured output and would show up as literal garbled text instead of a
# real systemMessage. A dedicated, JSON-only command (the same pattern
# already used for PreCompact's "COMPACT FORMAT MANDATE" systemMessage in
# this repo's settings.json) is the only way to get a real, user-visible
# systemMessage from SessionStart without risking full_boot.sh's existing,
# hardened boot-context injection.
#
# Reads (read-only): .agent/memory/scratch/.last_activity.json (cross-
#   session, written by inject_pressure.sh's START and turn_end_stamp.sh's
#   END — see execution/hooks/lib/turn_timestamp.py).
# Writes: nothing — the next turn's START naturally overwrites the record.
# Output (stdout JSON): {"systemMessage": "Session started HH:MM:SS <tz> [— away <gap>]"}
#
# Hard rules: ALWAYS exit 0; never block session start; degrade to a bare
# "Session started ..." line (or emit nothing at all) on any failure.
set +e
exec 2>/dev/null

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
SCRATCH_DIR="${REPO_ROOT:-.}/.agent/memory/scratch"

if [ -f "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" ]; then
  timeout 4 python3 - "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" "$SCRATCH_DIR" <<'PYEOF'
import json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[1])))
import turn_timestamp as ts

scratch_dir = sys.argv[2]
now = int(time.time())

try:
    prior = ts.read_last_activity(ts.last_activity_path(scratch_dir))
    away = (now - prior) if prior is not None else None
    line = ts.format_session_start_line(now, away)
    print(json.dumps({"systemMessage": line}))
except Exception:
    pass
PYEOF
fi

exit 0
