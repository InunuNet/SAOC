#!/usr/bin/env python3
"""Exclusive turns on the shared desktop, one holder at a time across all agent sessions.

Usage:
    desktop_turn.py run [--project NAME] [--reason TEXT] [--max-seconds N] -- <cmd...>
    desktop_turn.py acquire --project NAME --reason TEXT [--max-seconds N]
    desktop_turn.py release
    desktop_turn.py status

`run` takes a machine-wide flock, records the holder in holder.json, runs the command in its own
process group, passes its exit code through, and kills the group past the time limit (exit 124).
`acquire` and `release` serve agents that cannot wrap one command: acquire returns 0 when the turn
is obtained and 3 when held; a holder whose pid is dead or whose expiry passed is stale and
treated as free. Waiting longer than the wait limit exits 75 with "desktop busy".

Env: DESKTOP_TURN_HOME (default ~/.athanor/voice), DESKTOP_TURN_MAX_SECONDS (default 600),
DESKTOP_TURN_MAX_WAIT_SECONDS (default 900). Files in the home: .desktop.lock, holder.json,
desktop.log. A missing home is never created: the tool prints a notice and exits 0.
"""
import argparse
import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows: msvcrt byte lock stands in for flock
    fcntl = None
    import msvcrt


def _flock(fd, nonblock=False):
    """Exclusive lock on fd; raises OSError when nonblock and the lock is held."""
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_EX | (fcntl.LOCK_NB if nonblock else 0))
        return
    while True:
        try:
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            return
        except OSError:
            if nonblock:
                raise
            time.sleep(0.1)


def _funlock(fd):
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_UN)
        return
    try:
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    except OSError:
        pass

DEFAULT_HOME = "~/.athanor/voice"
DEFAULT_MAX_SECONDS = 600
DEFAULT_MAX_WAIT_SECONDS = 900
LOCK_NAME = ".desktop.lock"
HOLDER_NAME = "holder.json"
LOG_NAME = "desktop.log"
POLL_SECONDS = 0.1
KILL_GRACE_SECONDS = 2.0
EXIT_TIMEOUT = 124
EXIT_BUSY = 75
EXIT_HELD = 3


def _now():
    return time.time()


def _iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _int_env(name, default):
    try:
        value = int(os.environ.get(name, ""))
    except ValueError:
        return default
    return value if value > 0 else default


def _home():
    return Path(os.environ.get("DESKTOP_TURN_HOME") or DEFAULT_HOME).expanduser()


def _log(home, line):
    try:
        fd = os.open(str(home / LOG_NAME), os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
    except OSError:
        return
    try:
        os.write(fd, ("%s %s\n" % (_iso(_now()), line)).encode("utf-8", "replace"))
    except OSError:
        pass
    finally:
        os.close(fd)


def _read_holder(home):
    try:
        data = json.loads((home / HOLDER_NAME).read_text())
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _clear_holder(home):
    try:
        (home / HOLDER_NAME).unlink()
    except OSError:
        pass


def _write_holder(home, info):
    tmp = home / (HOLDER_NAME + ".tmp.%d" % os.getpid())
    tmp.write_text(json.dumps(info))
    os.replace(str(tmp), str(home / HOLDER_NAME))


def _pid_alive(pid):
    try:
        os.kill(int(pid), 0)
    except ProcessLookupError:
        return False
    except (PermissionError, ValueError, TypeError):
        return True
    return True


def _is_stale(info):
    if not info:
        return True
    try:
        if float(info.get("expires_epoch", 0)) <= _now():
            return True
    except (TypeError, ValueError):
        return True
    return not _pid_alive(info.get("pid"))


def _live_holder(home):
    """Return the current holder, or None when free; a stale holder file is cleared."""
    info = _read_holder(home)
    if info is None:
        return None
    if _is_stale(info):
        _clear_holder(home)
        return None
    return info


def _describe(info):
    return "held by %s pid %s reason %s since %s expires %s" % (
        info.get("project"), info.get("pid"), info.get("reason"),
        info.get("acquired_at"), info.get("expires_at"))


def _holder_info(project, reason, pid, max_seconds):
    now = _now()
    return {"project": project, "pid": pid, "reason": reason, "acquired_at": _iso(now),
            "expires_at": _iso(now + max_seconds), "expires_epoch": now + max_seconds,
            "acquired_epoch": now}


def _open_lock(home):
    return os.open(str(home / LOCK_NAME), os.O_RDWR | os.O_CREAT, 0o644)


def _lock_blocking(fd, home, max_wait):
    """flock with a deadline; returns True when held. A stale holder never blocks the flock."""
    deadline = _now() + max_wait
    while True:
        try:
            _flock(fd, nonblock=True)
            return True
        except OSError:
            if _now() >= deadline:
                return False
            time.sleep(POLL_SECONDS)


def _busy(home):
    info = _live_holder(home)
    print("desktop busy" + ((": " + _describe(info)) if info else ""))
    return EXIT_BUSY


def _kill_group(proc):
    if os.name == "nt":
        proc.kill()
        proc.wait()
        return
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(proc.pid, sig)
        except OSError:
            return
        try:
            proc.wait(timeout=KILL_GRACE_SECONDS)
            return
        except subprocess.TimeoutExpired:
            continue


def _run_command(cmd, max_seconds):
    try:
        proc = subprocess.Popen(cmd, start_new_session=True)
    except OSError as exc:
        print("desktop_turn: cannot run %s: %s" % (cmd[0], exc), file=sys.stderr)
        return 127
    try:
        return proc.wait(timeout=max_seconds)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        print("desktop_turn: command exceeded %ds, killed" % max_seconds, file=sys.stderr)
        return EXIT_TIMEOUT
    except KeyboardInterrupt:
        _kill_group(proc)
        return 130


def cmd_run(args, home):
    cmd = args.cmd[1:] if args.cmd[:1] == ["--"] else args.cmd
    if not cmd:
        print("desktop_turn: run needs a command after --", file=sys.stderr)
        return 2
    max_seconds = args.max_seconds or _int_env("DESKTOP_TURN_MAX_SECONDS", DEFAULT_MAX_SECONDS)
    max_wait = _int_env("DESKTOP_TURN_MAX_WAIT_SECONDS", DEFAULT_MAX_WAIT_SECONDS)
    fd = _open_lock(home)
    if not _lock_blocking(fd, home, max_wait):
        os.close(fd)
        return _busy(home)
    started = _now()
    _write_holder(home, _holder_info(args.project, args.reason, os.getpid(), max_seconds))
    _log(home, "acquire project=%s pid=%d reason=%s" % (args.project, os.getpid(), args.reason))
    rc = EXIT_TIMEOUT
    try:
        rc = _run_command(cmd, max_seconds)
    finally:
        _clear_holder(home)
        _log(home, "release project=%s pid=%d reason=%s rc=%s held=%.1fs" % (
            args.project, os.getpid(), args.reason, rc, _now() - started))
        _funlock(fd)
        os.close(fd)
    return rc


def cmd_acquire(args, home):
    max_seconds = args.max_seconds or _int_env("DESKTOP_TURN_MAX_SECONDS", DEFAULT_MAX_SECONDS)
    fd = _open_lock(home)
    try:
        _flock(fd)
        info = _live_holder(home)
        if info:
            print(_describe(info))
            return EXIT_HELD
        owner = os.getppid()
        _write_holder(home, _holder_info(args.project, args.reason, owner, max_seconds))
        _log(home, "acquire project=%s pid=%d reason=%s" % (args.project, owner, args.reason))
        return 0
    finally:
        _funlock(fd)
        os.close(fd)


def cmd_release(args, home):
    info = _read_holder(home)
    _clear_holder(home)
    if info:
        held = _now() - float(info.get("acquired_epoch", _now()))
        _log(home, "release project=%s pid=%s reason=%s rc=0 held=%.1fs" % (
            info.get("project"), info.get("pid"), info.get("reason"), held))
    return 0


def cmd_status(args, home):
    info = _read_holder(home)
    if info and not _is_stale(info):
        print(_describe(info))
        return 0
    if info:
        print("stale holder cleared: %s" % _describe(info))
        _clear_holder(home)
    print("free")
    return 0


def _parser():
    parser = argparse.ArgumentParser(prog="desktop_turn.py", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="action", required=True)
    default_project = Path.cwd().name
    for name in ("run", "acquire"):
        p = sub.add_parser(name)
        p.add_argument("--project", default=default_project)
        p.add_argument("--reason", default="unspecified")
        p.add_argument("--max-seconds", type=int, default=0)
        if name == "run":
            p.add_argument("cmd", nargs=argparse.REMAINDER)
    sub.add_parser("release")
    sub.add_parser("status")
    return parser


def main(argv=None):
    args = _parser().parse_args(argv)
    home = _home()
    if not home.is_dir():
        print("desktop_turn: home %s missing, no turn taken" % home)
        if args.action == "run":
            cmd = args.cmd[1:] if args.cmd[:1] == ["--"] else args.cmd
            return _run_command(cmd, _int_env("DESKTOP_TURN_MAX_SECONDS", DEFAULT_MAX_SECONDS)) \
                if cmd else 0
        return 0
    handlers = {"run": cmd_run, "acquire": cmd_acquire, "release": cmd_release,
                "status": cmd_status}
    return handlers[args.action](args, home)


if __name__ == "__main__":
    sys.exit(main())
