#!/usr/bin/env bash
# compaction_nudge.sh — UserPromptSubmit command hook.
# One-shot, fail-soft consumer of .agent/memory/scratch/compaction-hint.json,
# written by mission.py's emit_compaction_hint() at mission creation, checkpoint,
# gate pass, and close-out. If a hint file exists, surface it as additionalContext
# telling Brad this is a good moment to run /compact, then delete the file
# (consumed at most once, whether or not it was usable). If absent or corrupt,
# emit an empty JSON object and exit 0 — this hook runs on every user turn and
# must never block a turn. Mirrors post_compact_inject.sh's flag-file pattern.
set -uo pipefail
FLAG=".agent/memory/scratch/compaction-hint.json"

if [ -f "$FLAG" ]; then
  python3 - "$FLAG" <<'PYEOF'
import json, re, sys, pathlib

# Untrusted-input sanitization (F4): compaction-hint.json is writable by any
# subagent that can touch scratch, so trigger/reason are not harness-authored
# text — they must be validated before interpolation into additionalContext.
# See goldens/compaction_nudge_spec.md SANITIZATION RULES and DECISION.md
# Ruling 5. Rejection never suppresses the nudge — only substitutes a fixed
# placeholder — since the nudge reaching Brad is the mission's entire point.
REASON_RE = re.compile(r"\A[A-Za-z0-9_-]{1,40}\Z")
REASON_PLACEHOLDER = "(reason omitted — invalid format)"
VALID_TRIGGERS = {"checkpoint", "gate_pass", "close_out"}
TRIGGER_PLACEHOLDER = "mission-event"


def sanitize_reason(value):
    if isinstance(value, str) and REASON_RE.match(value):
        return value
    return REASON_PLACEHOLDER


def sanitize_trigger(value):
    if value in VALID_TRIGGERS:
        return value
    return TRIGGER_PLACEHOLDER


flag_path = pathlib.Path(sys.argv[1])
output = {}
try:
    data = json.loads(flag_path.read_text())
    if isinstance(data, dict):
        trigger = data.get("trigger")
        reason = data.get("reason")
        if trigger and reason:
            safe_trigger = sanitize_trigger(trigger)
            safe_reason = sanitize_reason(reason)
            nudge = (
                f"⚡ MISSION BOUNDARY ({safe_trigger}): {safe_reason} — "
                "context is a good candidate for /compact now."
            )
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": nudge,
                }
            }
except Exception:
    output = {}
finally:
    try:
        flag_path.unlink()
    except Exception:
        pass

print(json.dumps(output))
PYEOF
else
  echo "{}"
fi
