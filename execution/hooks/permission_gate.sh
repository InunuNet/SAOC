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
REQUEST="$SCRATCH/permission_request.json"
COMMS_WINDOW_SECONDS=1800

INPUT="$(cat 2>/dev/null || true)"

case "$MODE" in
request)
    UNATT=0; [ -f "$UNATTENDED" ] && UNATT=1
    HOOK_INPUT="$INPUT" python3 - "$DENIALS" "$REQUEST" "$UNATT" <<'PY' 2>/dev/null || exit 0
import json, os, re, sys, time
try:
    data = json.loads(os.environ["HOOK_INPUT"])
except Exception:  # malformed or absurdly nested: still answer the prompt below
    data = {}
if not isinstance(data, dict):
    data = {}
MASKS = (
    (r"(?i)([A-Za-z0-9_]*(?:key|token|secret|pass[a-z]*|auth[a-z]*)=)\S+", r"\1***"),
    (r"(?i)(bearer|basic|token)\s+\S+", r"\1 ***"),
    (r"://[^/@\s]+:[^@\s]+@", "://***@"),
    (r"(?i)(--(?:password|token|secret|api-key)[ =])\S+", r"\1***"),
    (r"xox[a-z]-\S+", "***"),
    (r"sk-[A-Za-z0-9_-]{8,}", "***"),
    (r"gh[a-z]_[A-Za-z0-9]{8,}", "***"),
)
DETAIL_MAX = 300
MASK_MAX_DEPTH = 20
DETAIL_WITHHELD = "(detail withheld)"
SECRET_KEY = re.compile(r"(?i)key|token|secret|pass|auth|credential")


def safe_write(path, text, append):
    """Write inside the project only. Every directory is opened O_NOFOLLOW relative to the
    verified parent fd, and the file likewise, so a symlink swapped in at any point is
    refused, never followed. Failure is silent: it must not change the decision."""
    try:
        parts = os.path.normpath(path).split(os.sep)
        fd = os.open(".", os.O_RDONLY | os.O_DIRECTORY)
        for part in parts[:-1]:
            try:
                os.mkdir(part, 0o755, dir_fd=fd)
            except FileExistsError:
                pass
            fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
        flags = os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW | (os.O_APPEND if append else os.O_TRUNC)
        out = os.open(parts[-1], flags, 0o644, dir_fd=fd)
        with os.fdopen(out, "w") as fh:
            fh.write(text)
    except (OSError, ValueError):
        pass


def mask_structured(value, depth=0):
    """Mask the value of any credential-looking key; a subtree below the bound is dropped."""
    if depth > MASK_MAX_DEPTH:
        return "***"
    if isinstance(value, dict):
        return {k: "***" if SECRET_KEY.search(str(k)) else mask_structured(v, depth + 1)
                for k, v in value.items()}
    if isinstance(value, list):
        return [mask_structured(v, depth + 1) for v in value]
    return value


tool = data.get("tool_name")
tin = data.get("tool_input")
if not isinstance(tool, str):
    tool = "?"
tool = tool[:DETAIL_MAX]
if not isinstance(tin, dict):
    tin = {}
try:
    detail = json.dumps(mask_structured(tin))
    for pattern, repl in MASKS:
        detail = re.sub(pattern, repl, detail)
    detail = detail[:DETAIL_MAX]
except Exception:  # whatever it was, never store it and never skip the decision
    detail = DETAIL_WITHHELD
# The Notification that follows carries only a message: remember what is waiting.
safe_write(sys.argv[2], json.dumps({"tool": tool, "detail": detail}), False)
if sys.argv[3] != "1":
    sys.exit(0)  # attended: print nothing so the normal prompt shows
safe_write(sys.argv[1], f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')}\t{tool}\t{detail}\n", True)
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
    HOOK_INPUT="$INPUT" python3 - "$PENDING" "$COMMS_WINDOW_SECONDS" "$REQUEST" <<'PY' 2>/dev/null || exit 0
import fcntl, json, os, sys, time
from pathlib import Path
pending, window = Path(sys.argv[1]), int(sys.argv[2])
try:
    if Path(sys.argv[3]).is_symlink():
        raise OSError("request file is a symlink")
    waiting = json.loads(Path(sys.argv[3]).read_text())
    waiting_note = f" Waiting: {waiting['tool']} {waiting['detail']}"
except (OSError, ValueError, KeyError):
    waiting_note = ""
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
                 f"{message}.{waiting_note} Nothing proceeds until someone answers it in the "
                 f"terminal. (permission_gate.sh; one notice per "
                 f"{window // 60} min)\n")
    record["posted_at"] = now
pending.write_text(json.dumps(record))
PY
    ;;
attended)
    rm -f "$UNATTENDED" "$PENDING" "$PENDING.lock" "$REQUEST"
    ;;
esac
exit 0
