#!/usr/bin/env python3
"""Autocompact decider: compact the session after a clean mission close.

Two delivery backends behind one injector interface: Ghostty AppleScript
injection into the session's own terminal (resolved by the session's cwd from
`claude agents --json`), and a zero-permission fallback that lowers
autoCompactWindow in .claude/settings.local.json. Every branch fails closed:
do nothing and let the native auto-compact window handle it.

Driven by execution/hooks/autocompact_after_mission.sh (Stop hook).
"""

import json
import logging
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

LOG = logging.getLogger("autocompact_decider")

AUTOCOMPACT_FLOOR = 100000
SETTINGS_LOCAL = Path(".claude/settings.local.json")
ARM_FLAG = Path(".agent/memory/scratch/autocompact-armed.json")
ROUTE_A_RECORD = Path(".agent/memory/scratch/autocompact-route-a.json")
CONF_FILE = Path(".agent/autocompact.conf")
MISSIONS_DIR = Path(".agent/memory/project/missions")
METHOD_ENV = "AUTOCOMPACT_METHOD"
SHADOW_ENV = "CLAUDE_CODE_AUTO_COMPACT_WINDOW"
METHODS = ("ghostty", "settings")
OFF_METHOD = "off"
NOT_AUTHORIZED_MARKERS = ("-1743", "not authorized to send apple events")
DEFAULT_METHOD = "ghostty"
HOOK_BUDGET_SECONDS = 20
STEP_TIMEOUT_SECONDS = 5
FLAG_MAX_AGE_SECONDS = 30 * 60
ROUTE_A_MAX_AGE_SECONDS = 2 * 60 * 60
MAX_PPID_HOPS = 32
CLAUDE_COMM_PREFIX = "claude"
GHOSTTY_NAME = "ghostty"
FIELD_SEP = "\t"
SURFACE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")


def is_safe_to_compact(*, mission_status, gate_green, git_clean, checkpoint_on_disk):
    """True only when every precondition is explicitly satisfied."""
    return (
        mission_status == "done"
        and gate_green is True
        and git_clean is True
        and checkpoint_on_disk is True
    )


def resolve_target_surface(session_cwd, surfaces):
    """Return the id of the single surface whose cwd equals session_cwd, else None."""
    matches = [s for s in surfaces if s.get("working_directory") == session_cwd]
    if len(matches) != 1:
        return None
    return matches[0].get("id") or None


def _read_json(path):
    try:
        data = json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {}
    return data if isinstance(data, dict) else {}


def _record_path(settings_path, record_path):
    if record_path is not None:
        return Path(record_path)
    if Path(settings_path) == SETTINGS_LOCAL:
        return ROUTE_A_RECORD
    return Path(str(settings_path) + ".autocompact-prior")


def arm_route_a(settings_path=SETTINGS_LOCAL, window=AUTOCOMPACT_FLOOR, record_path=None):
    """Merge autoCompactWindow into the settings file, preserving every other key.

    The prior value (or its absence) is saved on the first arm only so disarm can
    restore it exactly; every arm records the value it wrote, so disarm can tell a
    manual edit made since from its own window.
    """
    settings_path = Path(settings_path)
    record = _record_path(settings_path, record_path)
    data = _read_json(settings_path)
    saved = _read_record(record) if record.exists() else None
    if saved is not None:
        saved["written"] = window
        record.write_text(json.dumps(saved))
    else:
        record.parent.mkdir(parents=True, exist_ok=True)
        record.write_text(json.dumps({
            "had_prior": "autoCompactWindow" in data,
            "prior": data.get("autoCompactWindow"),
            "written": window,
            "ts": time.time(),
        }))
    data["autoCompactWindow"] = window
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings_path.write_text(json.dumps(data, indent=2) + "\n")


def _read_record(record):
    """The arm record, or None when it cannot be read (corrupt JSON, wrong shape)."""
    try:
        data = json.loads(Path(record).read_text())
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def disarm_route_a(settings_path=SETTINGS_LOCAL, record_path=None):
    """Restore autoCompactWindow to its pre-arm state; no record or file is a no-op.

    Returns "kept" when the current value is not the one we wrote (a manual edit):
    that value stays and only the record is dropped. An unreadable record removes
    the window outright, so a lowered window can never outlive its record.
    """
    settings_path = Path(settings_path)
    record = _record_path(settings_path, record_path)
    if not record.exists():
        return None
    saved = _read_record(record)
    outcome = None
    if settings_path.exists():
        data = _read_json(settings_path)
        if saved is None:
            data.pop("autoCompactWindow", None)
        elif "written" in saved and data.get("autoCompactWindow") != saved["written"]:
            outcome = "kept"
        elif saved.get("had_prior"):
            data["autoCompactWindow"] = saved.get("prior")
        else:
            data.pop("autoCompactWindow", None)
        if outcome != "kept":
            settings_path.write_text(json.dumps(data, indent=2) + "\n")
    record.unlink()
    return outcome


def expire_route_a(settings_path=SETTINGS_LOCAL, record_path=None):
    """Restore a Route-A window that outlived ROUTE_A_MAX_AGE_SECONDS."""
    record = _record_path(Path(settings_path), record_path)
    if not record.exists():
        return
    if time.time() - _read_json(record).get("ts", 0) > ROUTE_A_MAX_AGE_SECONDS:
        disarm_route_a(settings_path, record_path)


def route_a_shadowed():
    """True when the env var that outranks autoCompactWindow is set, making Route A inert."""
    if os.environ.get(SHADOW_ENV) is None:
        return False
    LOG.warning("%s is set and outranks autoCompactWindow; not arming the settings route",
                SHADOW_ENV)
    return True


def perform(*, safe, session_cwd, surfaces, method, injector, armer, disarmer):
    """Orchestrate one delivery. Returns "fired", "armed", "shadowed" or "noop"."""
    if not safe:
        return "noop"
    if method == "ghostty":
        surface = resolve_target_surface(session_cwd, surfaces)
        if surface is None:
            return "noop"
        injector(surface)
        return "fired"
    if method == "settings":
        if route_a_shadowed():
            return "shadowed"
        armer()
        return "armed"
    return "noop"


class _Budget:
    """Total wall-clock budget for one hook run; every subprocess draws from it."""

    def __init__(self, seconds):
        self.deadline = time.monotonic() + seconds

    def step_timeout(self):
        left = self.deadline - time.monotonic()
        if left <= 0:
            raise subprocess.TimeoutExpired("budget", HOOK_BUDGET_SECONDS)
        return min(STEP_TIMEOUT_SECONDS, left)


_BUDGET = _Budget(HOOK_BUDGET_SECONDS)


def _run(argv):
    return subprocess.run(
        argv, capture_output=True, text=True, timeout=_BUDGET.step_timeout(), check=True,
    ).stdout


def _osascript(script):
    return _run(["osascript", "-e", script])


def _real(path):
    return os.path.realpath(path) if path else ""


def list_ghostty_surfaces():
    """Enumerate Ghostty terminals as [{"id", "working_directory"}]; [] on any failure."""
    script = (
        'set out to ""\n'
        'tell application "Ghostty"\n'
        "  repeat with t in every terminal\n"
        "    set out to out & (id of t) & tab & (working directory of t) & linefeed\n"
        "  end repeat\n"
        "end tell\n"
        "return out"
    )
    try:
        raw = _osascript(script)
    except (OSError, subprocess.SubprocessError) as exc:
        LOG.warning("ghostty enumeration failed: %s", type(exc).__name__)
        return []
    surfaces = []
    for line in raw.splitlines():
        sid, sep, cwd = line.partition(FIELD_SEP)
        if sep and sid:
            surfaces.append({"id": sid, "working_directory": _real(cwd)})
    return surfaces


def ghostty_inject(surface_id):
    """Type /compact and Enter into one terminal by id in a single osascript call.

    On failure the outcome is unknown (text may be typed), so it is logged, never retried.
    """
    if not SURFACE_ID_RE.match(surface_id):
        LOG.warning("refusing surface id with unexpected characters")
        return
    script = (
        'tell application "Ghostty"\n'
        '  set t to terminal id "%s"\n'
        '  input text "/compact" to t\n'
        '  send key "enter" to t\n'
        "end tell" % surface_id
    )
    try:
        _osascript(script)
    except subprocess.CalledProcessError as exc:
        if any(m in (exc.stderr or "").lower() for m in NOT_AUTHORIZED_MARKERS):
            LOG.warning("ghostty automation not granted; nothing typed, falling back to settings")
            if not route_a_shadowed():
                arm_route_a()
        else:
            LOG.error("ghostty inject outcome unknown (CalledProcessError); not retrying")
    except (OSError, subprocess.SubprocessError) as exc:
        LOG.error("ghostty inject outcome unknown (%s); not retrying", type(exc).__name__)


def _git_clean():
    try:
        return _run(["git", "--no-optional-locks", "status", "--porcelain"]).strip() == ""
    except (OSError, subprocess.SubprocessError):
        return False


def _ancestor_chain(start_pid):
    """[(pid, comm)] from start_pid up through its parents; stops quietly on any ps failure."""
    chain = []
    pid = start_pid
    for _ in range(MAX_PPID_HOPS):
        try:
            line = _run(["ps", "-o", "ppid=,comm=", "-p", str(pid)]).strip()
        except (OSError, subprocess.SubprocessError):
            break
        ppid, _, comm = line.partition(" ")
        if not ppid.strip().isdigit():
            break
        chain.append((pid, os.path.basename(comm.strip())))
        pid = int(ppid)
        if pid <= 1:
            break
    return chain


def find_claude_ancestor_pid(start_pid=None):
    """Nearest ancestor process whose command name is claude; None if there is none."""
    own = os.getpid()
    for pid, comm in _ancestor_chain(own if start_pid is None else start_pid):
        if pid != own and comm.startswith(CLAUDE_COMM_PREFIX):
            return pid
    return None


def hosted_by_ghostty(claude_pid):
    """True only when this hook runs under Ghostty AND claude_pid descends from Ghostty."""
    if os.environ.get("TERM_PROGRAM", "").lower() != GHOSTTY_NAME:
        return False
    return any(GHOSTTY_NAME in comm.lower() for _, comm in _ancestor_chain(claude_pid))


def session_cwd_for_pid(pid):
    """Real cwd of the claude session with this pid per `claude agents --json`, else None."""
    try:
        agents = json.loads(_run(["claude", "agents", "--json"]))
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    for agent in agents if isinstance(agents, list) else []:
        if agent.get("pid") == pid and agent.get("cwd"):
            return _real(agent["cwd"])
    return None


def write_arm_flag(slug, mission_file):
    """Called by mission.py close-out: record which session armed, for the Stop hook."""
    if _method() == OFF_METHOD:
        return
    ARM_FLAG.parent.mkdir(parents=True, exist_ok=True)
    ARM_FLAG.write_text(json.dumps({
        "trigger": "close_out", "slug": slug, "mission_file": str(mission_file),
        "gate_green": True, "claude_pid": find_claude_ancestor_pid(),
        "ts": datetime.now(timezone.utc).isoformat(),
    }))


def _mission_text(mission_file):
    try:
        path = Path(mission_file).resolve()
        path.relative_to(MISSIONS_DIR.resolve())
        return path.read_text()
    except (OSError, ValueError):
        return ""


def _mission_status(text):
    match = re.search(r"(?m)^status:\s*['\"]?(\S+?)['\"]?\s*$", text)
    return match.group(1) if match else None


def _checkpoint_on_disk(text):
    return bool(re.search(r"(?ms)^last_checkpoint:\s*\n\s+\S", text)
                or re.search(r"(?m)^last_active_at:\s*\S", text))


def _flag_age_seconds(flag):
    try:
        when = datetime.fromisoformat(str(flag.get("ts")).replace("Z", "+00:00"))
    except ValueError:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - when).total_seconds()


def _method():
    chosen = os.environ.get(METHOD_ENV, "").strip()
    if not chosen:
        try:
            chosen = CONF_FILE.read_text().strip().splitlines()[0].strip()
        except (OSError, IndexError):
            chosen = ""
    if not chosen:
        return DEFAULT_METHOD
    return chosen if chosen in METHODS else OFF_METHOD  # unknown value fails closed


def _remove_flag():
    try:
        ARM_FLAG.unlink()
    except OSError:
        pass


def drop_own_flag():
    """PostCompact: a compaction already happened, so drop this session's pending arm flag."""
    try:
        pid = find_claude_ancestor_pid()
        if pid is not None and _read_json(ARM_FLAG).get("claude_pid") == pid:
            _remove_flag()
    except (OSError, ValueError) as exc:
        LOG.warning("could not drop arm flag: %s", type(exc).__name__)


def _decide(flag, claude_pid):
    text = _mission_text(flag.get("mission_file") or "")
    safe = flag.get("trigger") == "close_out" and is_safe_to_compact(
        mission_status=_mission_status(text),
        gate_green=flag.get("gate_green") is True,
        git_clean=_git_clean(),
        checkpoint_on_disk=_checkpoint_on_disk(text),
    )
    method = _method()
    if safe and method == "ghostty" and not hosted_by_ghostty(claude_pid):
        safe = False  # never type into a terminal that may not host this session
    session_cwd = session_cwd_for_pid(claude_pid) if safe and method == "ghostty" else None
    surfaces = list_ghostty_surfaces() if session_cwd else []
    return perform(
        safe=safe, session_cwd=session_cwd, surfaces=surfaces, method=method,
        injector=ghostty_inject, armer=arm_route_a, disarmer=disarm_route_a,
    )


def run_hook():
    """Stop-hook entry. Acts only on a flag armed by THIS claude session. Never raises."""
    global _BUDGET
    _BUDGET = _Budget(HOOK_BUDGET_SECONDS)
    try:
        expire_route_a()
        if not ARM_FLAG.exists():
            return "noop"
        flag = _read_json(ARM_FLAG)
        age = _flag_age_seconds(flag)
        if age is None or age > FLAG_MAX_AGE_SECONDS:
            _remove_flag()
            return "noop"
        claude_pid = find_claude_ancestor_pid()
        if claude_pid is None or claude_pid != flag.get("claude_pid"):
            return "noop"  # another session's flag: leave it untouched
        try:
            return _decide(flag, claude_pid)
        finally:
            _remove_flag()
    except Exception as exc:  # fail closed: the native window handles it
        LOG.error("autocompact hook failed: %s", type(exc).__name__)
        return "noop"


def main(argv):
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
    command = argv[1] if len(argv) > 1 else ""
    if command == "run":
        run_hook()
        return 0
    if command == "disarm":
        disarm_route_a()
        drop_own_flag()
        return 0
    LOG.error("usage: autocompact_decider.py run|disarm")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
