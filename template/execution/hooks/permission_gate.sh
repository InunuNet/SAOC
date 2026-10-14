#!/usr/bin/env bash
# permission_gate.sh <request|notify|attended> — a permission prompt must not
# freeze an unattended session silently.
#
# A native ask-prompt waits forever: the Bash timeout only starts once a
# command runs, and a command at a prompt never started. Left overnight, the
# session stops at the first ask and nothing says so (backlog P1, 2026-09-18).
#
#   request   PermissionRequest. In UNATTENDED mode, DENY at once with a reason
#             the agent can act on, and log it. Otherwise print nothing, so the
#             normal prompt shows. NEVER allows -- an auto-allow defeats the
#             prompt it answers.
#   notify    Notification/permission_prompt (a prompt has waited ~6s with no
#             keystroke). Write a pending marker and post one comms.md block,
#             rate-limited, so a stuck session is visible from outside it.
#   attended  UserPromptSubmit. The operator typed, so they are here: clear
#             UNATTENDED and the pending marker.
#
# UNATTENDED mode = .agent/memory/scratch/UNATTENDED exists. The agent writes it
# when the operator says they are away; the operator's next prompt removes it.
#
# Never blocks, never fails a tool call: every error path exits 0 silently,
# which leaves the permission flow exactly as it would be without this hook.
set -u

MODE="${1:-}"
SCRATCH=".agent/memory/scratch"
UNATTENDED="$SCRATCH/UNATTENDED"
PENDING="$SCRATCH/permission_pending.json"
DENIALS="$SCRATCH/permission_denials.log"
COMMS_WINDOW_SECONDS=1800

INPUT="$(cat 2>/dev/null || true)"

case "$MODE" in
request)
    [ -f "$UNATTENDED" ] || exit 0
    HOOK_INPUT="$INPUT" python3 - "$DENIALS" <<'PY' 2>/dev/null || exit 0
import json, os, sys, time
try:
    data = json.loads(os.environ["HOOK_INPUT"])
except Exception:
    sys.exit(0)  # malformed input: make no decision
tool = data.get("tool_name", "?")
detail = json.dumps(data.get("tool_input", {}))[:300]
os.makedirs(os.path.dirname(sys.argv[1]), exist_ok=True)
with open(sys.argv[1], "a") as fh:
    fh.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')}\t{tool}\t{detail}\n")
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
        "behavior": "deny",
        "message": (
            "UNATTENDED: the operator is away, so this permission prompt was "
            "denied instead of waiting on nobody. Do not retry it. Use a route "
            "that needs no approval (project-relative paths, .tmp/sandbox/, "
            "execution/safe_delete.py), or skip this step and list it for the "
            "operator in your report. Logged to "
            ".agent/memory/scratch/permission_denials.log."),
    },
}}))
PY
    ;;
notify)
    HOOK_INPUT="$INPUT" python3 - "$PENDING" "$COMMS_WINDOW_SECONDS" <<'PY' 2>/dev/null || exit 0
import fcntl, json, os, sys, time
from pathlib import Path
pending, window = Path(sys.argv[1]), int(sys.argv[2])
pending.parent.mkdir(parents=True, exist_ok=True)
# Concurrent prompts (subagents) fire notify together; serialise the
# read-check-append so the window really yields one notice (Codex QA).
lock = open(str(pending) + ".lock", "a")
fcntl.flock(lock, fcntl.LOCK_EX)
try:
    data = json.loads(os.environ["HOOK_INPUT"])
except Exception:
    data = {}
now = time.time()
previous = None
try:
    previous = json.loads(pending.read_text()).get("posted_at")
except Exception:
    pass
if not isinstance(previous, (int, float)) or isinstance(previous, bool):
    previous = None  # a corrupt marker must not silence the notice
message = str(data.get("message", "a permission prompt"))[:200]
record = {"since": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "message": message,
          "posted_at": previous}
if previous is None or now - previous > window:
    try:
        project = Path("WORKSPACE").read_text().strip() or "project"
    except OSError:
        project = "project"
    with open("comms.md", "a") as fh:
        fh.write(f"\n## [{project} -> OPERATOR] {time.strftime('%Y-%m-%d %H:%M')} — "
                 f"session waiting on a permission prompt\n\n"
                 f"{message}. Nothing proceeds until someone answers it in the "
                 f"terminal. (permission_gate.sh; one notice per "
                 f"{window // 60} min)\n")
    record["posted_at"] = now
pending.write_text(json.dumps(record))
PY
    ;;
attended)
    rm -f "$UNATTENDED" "$PENDING" "$PENDING.lock"
    ;;
esac
exit 0
