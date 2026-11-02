#!/usr/bin/env python3
"""Speak one short sentence through the shared Voice service, one voice at a time.

Usage:
    voice_say.py [--hook] [--home DIR] [--project-dir DIR]
                 ( --text T | --event gate-green --mission SLUG | --event input-needed )

Policy lives here, the heavy part (model, venv) stays in the service folder, which defaults to
~/ai/Voice/MacOS. Nothing speaks until that folder holds a `.enabled` file, and nothing speaks
while the calling project has `.agent/memory/scratch/UNATTENDED`. Playback is a subprocess, so
a crashing backend cannot take the caller down. main() returns 0 on every path.

Env: VOICE_HOME, VOICE_BACKEND_CMD (spoken text appended as the last argument), VOICE_PLATFORM,
VOICE_MAX_WAIT_SECONDS. Files in the folder: .enabled, .speak.lock, .speak.log.
"""
import fcntl
import os
import shlex
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_HOME = "~/ai/Voice/MacOS"
DEFAULT_MAX_WAIT_SECONDS = 60
MAX_CHARS = 160
PLAYBACK_TIMEOUT_SECONDS = 120
GROUP_POLL_SECONDS = 0.05
VALUE_FLAGS = ("--home", "--project-dir", "--text", "--event", "--mission")
EVENTS = ("gate-green", "input-needed")
UNATTENDED_REL = Path(".agent") / "memory" / "scratch" / "UNATTENDED"


def _log(home, line):
    """Append one short line to the service log; a log that cannot be written is ignored."""
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        fd = os.open(str(home / ".speak.log"),
                     os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o644)
    except OSError:
        return
    try:
        os.write(fd, ("%s %s\n" % (stamp, line)).encode("utf-8", "replace"))
    except OSError:
        pass
    finally:
        os.close(fd)


class _Args:
    hook = False
    home = None
    project_dir = None
    text = None
    event = None
    mission = ""


def _parse(argv):
    """Parse by hand: the token after a value flag is always data, even when it starts with '-'
    (a mission slug of '-h' must still be announced). '--' ends the options; the rest is text.
    Returns None on an unknown flag, a missing value or a bad event."""
    args = _Args()
    tokens = list(argv)
    while tokens:
        token = tokens.pop(0)
        if token == "--":
            args.text = " ".join(tokens)
            break
        name, eq, value = token.partition("=")
        if name == "--hook" and not eq:
            args.hook = True
        elif name in VALUE_FLAGS:
            if not eq:
                if not tokens:
                    return None
                value = tokens.pop(0)
            setattr(args, name[2:].replace("-", "_"), value)
        else:
            return None
    if args.event is not None and args.event not in EVENTS:
        return None
    return args


def _message(args):
    if args.event == "gate-green":
        return "gate green, mission %s" % args.mission if args.mission else "gate green"
    if args.event == "input-needed":
        return "I need your input"
    return args.text or ""


def compose(project_dir, message):
    """Return '<project>: <message>' as one line of at most MAX_CHARS, cut at a word boundary."""
    message = " ".join(message.split())
    if not message:
        return ""
    prefix = os.path.basename(os.path.abspath(project_dir)) + ": "
    text = message if message.startswith(prefix) else prefix + message
    if len(text) <= MAX_CHARS:
        return text
    if text[MAX_CHARS] == " ":
        return text[:MAX_CHARS]
    cut = text[:MAX_CHARS].rfind(" ")
    return text[:cut] if cut > len(prefix) else text[:MAX_CHARS]


def _backend(home, text):
    override = os.environ.get("VOICE_BACKEND_CMD")
    if override:
        return shlex.split(override) + [text]
    python = home / ".venv-voice" / "bin" / "python"
    script = home / "tools" / "speak.py"
    if not (python.exists() and script.exists()):
        return None
    return [str(python), str(script), text]


def _silenced(home, project_dir):
    return not (home / ".enabled").exists() or (project_dir / UNATTENDED_REL).exists()


def _playback_limit():
    """Seconds a backend may run; a non-numeric or non-positive value falls back to the default."""
    try:
        value = float(os.environ.get("VOICE_PLAYBACK_TIMEOUT_SECONDS", PLAYBACK_TIMEOUT_SECONDS))
    except ValueError:
        return float(PLAYBACK_TIMEOUT_SECONDS)
    return value if value > 0 else float(PLAYBACK_TIMEOUT_SECONDS)


def _wait_limit():
    try:
        return float(os.environ.get("VOICE_MAX_WAIT_SECONDS", DEFAULT_MAX_WAIT_SECONDS))
    except ValueError:
        return float(DEFAULT_MAX_WAIT_SECONDS)


def _group_alive(pgid):
    try:
        os.killpg(pgid, 0)
    except (ProcessLookupError, PermissionError):
        return False
    return True


def _kill_group(pgid):
    try:
        os.killpg(pgid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def _play_group(cmd):
    """Run the backend in its own process group and return only when the whole group is gone, so
    the lock outlives the audio. A backend past the deadline is killed with its children and
    None is returned."""
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, start_new_session=True)
    limit = _playback_limit()
    deadline = time.monotonic() + limit
    try:
        code = proc.wait(timeout=limit)
        while _group_alive(proc.pid):
            if time.monotonic() >= deadline:
                return None
            time.sleep(GROUP_POLL_SECONDS)
        return code
    except subprocess.TimeoutExpired:
        return None
    finally:
        _kill_group(proc.pid)
        proc.wait()


def _play(home, project_dir, text, started):
    """Wait for the turn, then play. Everything here fails soft."""
    try:
        fd = os.open(str(home / ".speak.lock"), os.O_RDWR | os.O_CREAT, 0o600)
    except OSError:
        return
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        waited = time.monotonic() - started
        if waited > _wait_limit():
            _log(home, "dropped (waited %.0fs): %s" % (waited, text))
            return
        if _silenced(home, project_dir):
            return
        cmd = _backend(home, text)
        if cmd is None:
            return
        try:
            code = _play_group(cmd)
            if code is None:
                _log(home, "backend timeout, killed: %s" % text)
            else:
                _log(home, "spoke rc=%d: %s" % (code, text))
        except (OSError, subprocess.SubprocessError) as exc:
            _log(home, "backend failed (%s): %s" % (type(exc).__name__, text))
    finally:
        os.close(fd)


def _run(argv):
    started = time.monotonic()
    args = _parse(argv)
    if args is None:
        return
    project_dir = Path(args.project_dir or os.getcwd())
    home = Path(os.path.expanduser(args.home or os.environ.get("VOICE_HOME") or DEFAULT_HOME))
    reason = None
    if os.environ.get("VOICE_PLATFORM", sys.platform) != "darwin":
        reason = "voice output is macOS only"
    elif not home.is_dir():
        reason = "voice service folder not found: %s" % home
    if reason:
        if not args.hook:
            print("voice_say: %s" % reason, file=sys.stderr)
        return
    text = compose(project_dir, _message(args))
    if not text or _silenced(home, project_dir):
        return
    _play(home, project_dir, text, started)


def main(argv=None):
    try:
        _run(sys.argv[1:] if argv is None else argv)
    except Exception:  # a speaker must never fail its caller
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
