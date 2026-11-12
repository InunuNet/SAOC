#!/usr/bin/env python3
"""compact.py -- an agent schedules its own auto-compaction.

Usage:
    python3 execution/compact.py status
    python3 execution/compact.py now
    python3 execution/compact.py delay [--by N]
    python3 execution/compact.py restore
    python3 execution/compact.py trigger

The statusline mirrors the live context reading to
``.agent/memory/scratch/.context_now.json`` on every render. This script moves
``autoCompactWindow`` in ``.claude/settings.local.json`` relative to that reading:

  now      window BELOW the current context, so Claude Code compacts next turn.
           Refused under 60000 tokens: nothing worth compacting.
  delay    window ABOVE the current context (default +150000, capped at the
           model window), so a busy session is not compacted mid-task.
  restore  put the operator's prior value back exactly.
  status   print the reading and any active override.

Writes go through the Route A helpers in execution/hooks/lib/autocompact_decider.py,
which record the prior value on the first arm only: now -> delay -> restore returns
the original. The PostCompact hook disarms after the compaction this causes.
Writes are refused (exit 1, nothing changed) with no reading, a reading older than
10 minutes, or CLAUDE_CODE_AUTO_COMPACT_WINDOW set (it outranks the settings key).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

CONTEXT_NOW_DIR = Path(".agent/memory/scratch/context_now")
NO_PID = "nopid"
NO_INJECT_ENV = "ATHANOR_COMPACT_NO_INJECT"
WINDOW_ENV = "CLAUDE_CODE_AUTO_COMPACT_WINDOW"
DECIDER = Path(__file__).resolve().parent / "hooks" / "lib" / "autocompact_decider.py"
HERDR_TIMEOUT_SECONDS = 5
# /compact typed mid-turn is queued and never runs, so a detached waiter sends it
# once the pane's agent is idle or done; "blocked" is a permission prompt, never idle.
HERDR_IDLE_WAIT_MS = 30 * 60 * 1000
WAITER_DIR = Path(".agent/memory/scratch")
WAITER_LOG = WAITER_DIR / "compact_waiter.log"
READING_MAX_AGE_SECONDS = 10 * 60
# Claude Code accepts autoCompactWindow between 100000 and 1000000.
WINDOW_MIN = 100000
NOW_MIN_TOKENS = 60000
NOW_WINDOW_FRACTION = 0.6
DEFAULT_DELAY_TOKENS = 150000


def find_root() -> Path:
    here = Path.cwd().resolve()
    for candidate in (here, *here.parents):
        if (candidate / ".agent").is_dir():
            return candidate
    return here


def load_decider():
    spec = importlib.util.spec_from_file_location("autocompact_decider", DECIDER)
    if spec is None or spec.loader is None:
        raise SystemExit(f"compact.py: cannot load {DECIDER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_reading(claude_pid) -> dict | None:
    """This session's own reading; another session's is never consulted."""
    try:
        data = json.loads((CONTEXT_NOW_DIR / f"{claude_pid or NO_PID}.json").read_text())
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    for key in ("tokens", "window_size", "captured_at"):
        if isinstance(data.get(key), bool) or not isinstance(data.get(key), (int, float)):
            return None
    return data


def current_override() -> str:
    try:
        settings = json.loads(Path(".claude/settings.local.json").read_text())
    except (OSError, ValueError):
        return "none"
    value = settings.get("autoCompactWindow") if isinstance(settings, dict) else None
    return str(value) if value is not None else "none"


def effective_trigger() -> int | None:
    """The autoCompactWindow Claude Code uses: env, then settings.local.json, then settings.json."""
    raw = os.environ.get(WINDOW_ENV)
    if raw is not None:
        return int(raw) if raw.strip().isdigit() else None
    for name in ("settings.local.json", "settings.json"):
        try:
            data = json.loads(Path(".claude", name).read_text())
        except (OSError, ValueError):
            continue
        value = data.get("autoCompactWindow") if isinstance(data, dict) else None
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    return None


def cmd_trigger(_args) -> int:
    value = effective_trigger()
    if value is None:
        print("compact: no autoCompactWindow set in env or settings", file=sys.stderr)
        return 1
    print(value)
    return 0


def cmd_status(_args, _decider, reading) -> int:
    if reading is None:
        print("compact: no context reading yet (the statusline writes one each render)")
        return 1
    age = int(time.time() - reading["captured_at"])
    print(f"tokens {int(reading['tokens'])} of window {int(reading['window_size'])} "
          f"({reading.get('used_pct')}%), reading {age}s old; "
          f"autoCompactWindow in settings.local.json: {current_override()}")
    return 0


def refusal(reading, decider) -> str | None:
    if decider.route_a_shadowed():
        return (f"{decider.SHADOW_ENV} is set in the environment and outranks "
                "autoCompactWindow, so a write would have no effect")
    if reading is None:
        return "no context reading for this session; the statusline writes it each render"
    age = time.time() - reading["captured_at"]
    if age > READING_MAX_AGE_SECONDS:
        return f"context reading is {int(age)}s old (limit {READING_MAX_AGE_SECONDS}s)"
    return None


def herdr_binary() -> str | None:
    return os.environ.get("HERDR_BIN_PATH") or shutil.which("herdr")


def pane_owned_by(binary: str, pane: str, claude_pid) -> bool:
    """True only when herdr lists claude_pid among the pane's foreground processes."""
    if claude_pid is None:
        return False
    try:
        done = subprocess.run([binary, "pane", "process-info", "--pane", pane],
                              capture_output=True, text=True, timeout=HERDR_TIMEOUT_SECONDS)
        info = json.loads(done.stdout)["result"]["process_info"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        return False
    if done.returncode != 0 or not isinstance(info, dict):
        return False
    procs = info.get("foreground_processes")
    return any(isinstance(p, dict) and p.get("pid") == int(claude_pid)
               for p in procs if isinstance(p, dict)) if isinstance(procs, list) else False


def inject_herdr(claude_pid) -> str | None:
    """Run /compact in this session's own herdr pane; None when herdr is not in play.

    Returns the outcome line, which starts with "not injected" on failure.
    """
    pane = os.environ.get("HERDR_PANE_ID")
    binary = herdr_binary() if pane else None
    if not pane or not binary:
        return None
    if not pane_owned_by(binary, pane, claude_pid):
        return f"not injected (herdr pane {pane} not verified as this session's)"
    if live_waiter(pane):
        return f"/compact already queued for herdr pane {pane}; it is sent when this turn ends"
    detach = {"start_new_session": True} if os.name != "nt" else {}
    try:
        subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "inject-when-idle",
                          "--pane", pane, "--pid", str(claude_pid)],
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, **detach)
    except (OSError, ValueError) as exc:
        return f"not injected (herdr waiter failed to start: {type(exc).__name__})"
    return (f"queued /compact for herdr pane {pane}; it is sent when this turn ends "
            f"(outcome in {WAITER_LOG})")


def waiter_lock(pane: str) -> Path:
    return WAITER_DIR / f"compact_waiter_{pane.replace(':', '_').replace('/', '_')}.pid"


def live_waiter(pane: str) -> bool:
    """True while a waiter process for this pane is still alive."""
    try:
        pid = int(waiter_lock(pane).read_text().strip())
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    return True


def log_waiter(pane: str, outcome: str) -> None:
    try:
        WAITER_DIR.mkdir(parents=True, exist_ok=True)
        with WAITER_LOG.open("a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {pane} {outcome}\n")
    except OSError:
        pass


def wait_idle(binary: str, pane: str, timeout_ms: int) -> bool:
    try:
        waited = subprocess.run([binary, "agent", "wait", pane, "--until", "idle",
                                 "--until", "done", "--timeout", str(timeout_ms)],
                                capture_output=True, text=True, timeout=timeout_ms / 1000 + 60)
    except (OSError, subprocess.SubprocessError):
        return False
    return waited.returncode == 0


def cmd_inject_when_idle(args) -> int:
    """Detached waiter: send /compact once the pane's agent is idle or done, still ours.

    One waiter per pane (pid lock); outcomes go to WAITER_LOG.
    """
    lock = waiter_lock(args.pane)
    try:
        WAITER_DIR.mkdir(parents=True, exist_ok=True)
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        if live_waiter(args.pane):
            log_waiter(args.pane, "skipped: another waiter is queued")
            return 0
        lock.unlink(missing_ok=True)
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except OSError:
            return 1
    except OSError:
        return 1
    with os.fdopen(fd, "w") as f:
        f.write(str(os.getpid()))
    try:
        return _inject_when_idle(args)
    finally:
        lock.unlink(missing_ok=True)


def _inject_when_idle(args) -> int:
    binary = herdr_binary()
    if not binary:
        log_waiter(args.pane, "not sent: herdr not found")
        return 1
    if not wait_idle(binary, args.pane, HERDR_IDLE_WAIT_MS):
        log_waiter(args.pane, "not sent: agent never went idle (timeout or herdr error)")
        return 1
    if not pane_owned_by(binary, args.pane, args.pid):
        log_waiter(args.pane, "not sent: pane no longer this session's")
        return 1
    # Re-check right before typing: the agent may have hit a permission prompt.
    if not wait_idle(binary, args.pane, 1000):
        log_waiter(args.pane, "not sent: agent left idle before send")
        return 1
    try:
        done = subprocess.run([binary, "pane", "run", args.pane, "/compact"],
                              capture_output=True, text=True, timeout=HERDR_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        log_waiter(args.pane, f"not sent: herdr pane run failed ({type(exc).__name__})")
        return 1
    log_waiter(args.pane, "sent /compact" if done.returncode == 0
               else f"not sent: herdr pane run exited {done.returncode}")
    return done.returncode


def inject_compact(decider, claude_pid) -> str:
    """Run /compact in this session's own terminal: herdr pane, else a single Ghostty match."""
    if os.environ.get(NO_INJECT_ENV) == "1":
        return f"not injected ({NO_INJECT_ENV}=1)"
    herdr = inject_herdr(claude_pid)
    if herdr is not None and not herdr.startswith("not injected"):
        return herdr
    fallback = inject_ghostty(decider, claude_pid)
    return f"{herdr}; {fallback}" if herdr else fallback


def inject_ghostty(decider, claude_pid) -> str:
    if claude_pid is None or not decider.hosted_by_ghostty(claude_pid):
        return "not injected (session is not hosted by Ghostty)"
    session_cwd = decider.session_cwd_for_pid(claude_pid)
    if not session_cwd:
        return "not injected (session cwd unknown)"
    surface = decider.resolve_target_surface(session_cwd, decider.list_ghostty_surfaces())
    if surface is None:
        return "not injected (no single matching Ghostty terminal)"
    decider.ghostty_inject(surface)
    return "injected /compact into this session's terminal; it runs at the next turn boundary"


def cmd_now(_args, decider, reading, claude_pid) -> int:
    tokens = int(reading["tokens"])
    if tokens < NOW_MIN_TOKENS:
        print(f"compact: refused, only {tokens} tokens in context "
              f"(under {NOW_MIN_TOKENS}, nothing worth compacting)", file=sys.stderr)
        return 1
    window = max(WINDOW_MIN, int(tokens * NOW_WINDOW_FRACTION))
    decider.arm_route_a(window=window)
    route = inject_compact(decider, claude_pid)
    print(f"autoCompactWindow set to {window} (context is {tokens}); {route}. "
          "A running session reads the window only when it next starts or restarts.")
    return 0


def cmd_delay(args, decider, reading, _claude_pid) -> int:
    if args.by <= 0:
        print("compact: refused, --by must be a positive number of tokens", file=sys.stderr)
        return 1
    tokens = int(reading["tokens"])
    window = max(WINDOW_MIN, min(int(reading["window_size"]), tokens + args.by))
    decider.arm_route_a(window=window)
    print(f"autoCompactWindow set to {window}: compaction pushed out to {window} tokens "
          "until the next compaction or `compact.py restore`; it applies when the session "
          "next starts or restarts")
    return 0


def cmd_restore(_args, decider, _reading, _claude_pid) -> int:
    if not decider.ROUTE_A_RECORD.exists():
        if current_override() != "none":
            print("compact: refused, autoCompactWindow is set but compact.py holds no record "
                  "of changing it; edit .claude/settings.local.json by hand if it is wrong",
                  file=sys.stderr)
            return 1
        print("compact: nothing to restore")
        return 0
    outcome = decider.disarm_route_a()
    if outcome == "kept":
        print(f"autoCompactWindow left at {current_override()}: it was edited after "
              "compact.py wrote it, so that value is kept")
    else:
        print(f"autoCompactWindow restored to the prior value ({current_override()})")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Schedule this session's auto-compaction.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    sub.add_parser("now")
    delay = sub.add_parser("delay")
    delay.add_argument("--by", type=int, default=DEFAULT_DELAY_TOKENS,
                       help="tokens of headroom above current context")
    sub.add_parser("restore")
    sub.add_parser("trigger")
    waiter = sub.add_parser("inject-when-idle")
    waiter.add_argument("--pane", required=True)
    waiter.add_argument("--pid", type=int, required=True)
    args = parser.parse_args(argv)

    os.chdir(find_root())
    if args.command == "trigger":
        return cmd_trigger(args)
    if args.command == "inject-when-idle":
        return cmd_inject_when_idle(args)
    decider = load_decider()
    claude_pid = decider.find_claude_ancestor_pid()
    reading = read_reading(claude_pid)
    if args.command == "status":
        return cmd_status(args, decider, reading)
    if args.command == "restore":
        return cmd_restore(args, decider, reading, claude_pid)
    reason = refusal(reading, decider)
    if reason:
        print(f"compact: refused, {reason}", file=sys.stderr)
        return 1
    commands = {"now": cmd_now, "delay": cmd_delay}
    return commands[args.command](args, decider, reading, claude_pid)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
